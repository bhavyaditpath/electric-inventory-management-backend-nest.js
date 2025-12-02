import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { Request } from './entities/request.entity';
import { User } from '../user/entities/user.entity';
import { Purchase } from '../purchase/entities/purchase.entity';
import { UserRole } from '../shared/enums/role.enum';
import { RequestStatus } from '../shared/enums/request-status.enum';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
  ) {}

  async create(createRequestDto: CreateRequestDto, requestingUser: User) {
    // Validate admin user exists and is admin
    const adminUser = await this.userRepository.findOne({
      where: { id: createRequestDto.adminUserId, role: UserRole.ADMIN },
    });
    if (!adminUser) {
      throw new BadRequestException('Invalid admin user');
    }

    // Validate purchase exists and belongs to admin
    const purchase = await this.purchaseRepository.findOne({
      where: { id: createRequestDto.purchaseId, userId: adminUser.id },
    });
    if (!purchase) {
      throw new BadRequestException('Purchase not found or does not belong to admin');
    }

    // Check if requesting user is branch user
    if (requestingUser.role !== UserRole.BRANCH) {
      throw new BadRequestException('Only branch users can create requests');
    }

    const request = this.requestRepository.create({
      ...createRequestDto,
      requestingUserId: requestingUser.id,
      status: RequestStatus.REQUEST,
    });

    return this.requestRepository.save(request);
  }

  async findAll(user: User) {
    const query = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requestingUser', 'requestingUser')
      .leftJoinAndSelect('request.adminUser', 'adminUser')
      .leftJoinAndSelect('request.purchase', 'purchase')
      .where('request.isRemoved = :isRemoved', { isRemoved: false });

    if (user.role === UserRole.ADMIN) {
      query.andWhere('request.adminUserId = :userId', { userId: user.id });
    } else if (user.role === UserRole.BRANCH) {
      query.andWhere('request.requestingUserId = :userId', { userId: user.id });
    }

    return query.getMany();
  }

  async findOne(id: number, user: User) {
    const request = await this.requestRepository.findOne({
      where: { id, isRemoved: false },
      relations: ['requestingUser', 'adminUser', 'purchase'],
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Check permissions
    if (user.role === UserRole.ADMIN && request.adminUserId !== user.id) {
      throw new BadRequestException('Access denied');
    }
    if (user.role === UserRole.BRANCH && request.requestingUserId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    return request;
  }

  async update(id: number, updateRequestDto: UpdateRequestDto, user: User) {
    const request = await this.findOne(id, user);

    const oldStatus = request.status;
    const newStatus = updateRequestDto.status;

    // Check permissions based on status change
    if (newStatus) {
      if (user.role === UserRole.ADMIN) {
        // Admins can update to Accept, Reject, InTransit
        if (request.adminUserId !== user.id) {
          throw new BadRequestException('Only assigned admin can update request status');
        }
        if (![RequestStatus.ACCEPT, RequestStatus.REJECT, RequestStatus.IN_TRANSIT].includes(newStatus)) {
          throw new BadRequestException('Admins can only set status to Accept, Reject, or InTransit');
        }
      } else if (user.role === UserRole.BRANCH) {
        // Branch users can only update InTransit to Delivered
        if (request.requestingUserId !== user.id) {
          throw new BadRequestException('Access denied');
        }
        if (newStatus !== RequestStatus.DELIVERED || oldStatus !== RequestStatus.IN_TRANSIT) {
          throw new BadRequestException('Branch users can only mark InTransit requests as Delivered');
        }
      } else {
        throw new BadRequestException('Unauthorized to update request status');
      }

      // Validate status transitions
      await this.validateStatusTransition(oldStatus, newStatus, request);
    }

    // Update the request
    Object.assign(request, updateRequestDto);
    const updatedRequest = await this.requestRepository.save(request);

    // Handle inventory adjustments for Delivered status
    if (newStatus === RequestStatus.DELIVERED && oldStatus !== RequestStatus.DELIVERED) {
      await this.handleDelivery(request);
    }

    return updatedRequest;
  }

  async getAdminsForDropdown() {
    return this.userRepository.find({
      where: { role: UserRole.ADMIN, isRemoved: false },
      select: ['id', 'username'],
    });
  }

  private async validateStatusTransition(oldStatus: RequestStatus, newStatus: RequestStatus, request: Request) {
    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      [RequestStatus.REQUEST]: [RequestStatus.ACCEPT, RequestStatus.REJECT],
      [RequestStatus.ACCEPT]: [RequestStatus.IN_TRANSIT],
      [RequestStatus.IN_TRANSIT]: [RequestStatus.DELIVERED],
      [RequestStatus.REJECT]: [],
      [RequestStatus.DELIVERED]: [],
    };

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    // Additional validation for Accept: check stock availability
    if (newStatus === RequestStatus.ACCEPT) {
      await this.validateStockAvailability(request);
    }
  }

  private async validateStockAvailability(request: Request) {
    // Get admin's inventory for this purchase
    const adminInventory = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .where('purchase.userId = :userId AND purchase.productName = :productName AND purchase.brand = :brand AND purchase.isRemoved = :isRemoved', {
        userId: request.adminUserId,
        productName: request.purchase.productName,
        brand: request.purchase.brand,
        isRemoved: false,
      })
      .select('SUM(purchase.quantity)', 'totalQuantity')
      .getRawOne();

    const availableQuantity = Number(adminInventory?.totalQuantity || 0);

    if (availableQuantity < request.quantityRequested) {
      throw new BadRequestException(`Insufficient stock. Available: ${availableQuantity}, Requested: ${request.quantityRequested}`);
    }
  }

  private async handleDelivery(request: Request) {
    // Create a new purchase entry for the branch user (increasing their inventory)
    const branchPurchase = this.purchaseRepository.create({
      productName: request.purchase.productName,
      quantity: request.quantityRequested,
      unit: request.purchase.unit,
      pricePerUnit: request.purchase.pricePerUnit,
      totalPrice: request.quantityRequested * request.purchase.pricePerUnit,
      lowStockThreshold: request.purchase.lowStockThreshold,
      brand: request.purchase.brand,
      userId: request.requestingUserId,
      branchId: request.requestingUser.branchId,
      createdBy: request.adminUserId,
    });

    await this.purchaseRepository.save(branchPurchase);

    // Deduct quantity from admin's inventory by creating a negative purchase entry
    const adminDeduction = this.purchaseRepository.create({
      productName: request.purchase.productName,
      quantity: -request.quantityRequested, // Negative quantity to reduce inventory
      unit: request.purchase.unit,
      pricePerUnit: request.purchase.pricePerUnit,
      totalPrice: -(request.quantityRequested * request.purchase.pricePerUnit), // Negative total
      lowStockThreshold: request.purchase.lowStockThreshold,
      brand: request.purchase.brand,
      userId: request.adminUserId,
      branchId: null, // Admin doesn't have branch
      createdBy: request.adminUserId,
    });

    await this.purchaseRepository.save(adminDeduction);
  }

  remove(id: number) {
    return this.requestRepository.update(id, { isRemoved: true });
  }
}
