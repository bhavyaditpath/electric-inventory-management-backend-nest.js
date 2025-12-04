import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, Raw } from 'typeorm';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { Request } from './entities/request.entity';
import { User } from '../user/entities/user.entity';
import { Purchase } from '../purchase/entities/purchase.entity';
import { UserRole } from '../shared/enums/role.enum';
import { RequestStatus } from '../shared/enums/request-status.enum';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { GenericRepository } from '../shared/generic-repository';

@Injectable()
export class RequestService {
  private userRepository: GenericRepository<User>;

  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(User)
    userRepo: Repository<User>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
  ) {
    this.userRepository = new GenericRepository(userRepo);
  }

  async create(createRequestDto: CreateRequestDto, requestingUser: User): Promise<ApiResponse> {
    // Validate admin user exists and is admin
    const adminUser = await this.userRepository.withNoDeletedRecord().findOne({ id: createRequestDto.adminUserId, role: UserRole.ADMIN });
    if (!adminUser) {
      return ApiResponseUtil.error('Invalid admin user');
    }

    // // Validate purchase exists and belongs to admin
    // const purchase = await this.purchaseRepository.findOne({
    //   where: { id: createRequestDto.purchaseId, userId: adminUser.id },
    // });
    // if (!purchase) {
    //   return ApiResponseUtil.error('Purchase not found or does not belong to admin');
    // }

    // Check if requesting user is branch user
    if (requestingUser.role !== UserRole.BRANCH) {
      return ApiResponseUtil.error('Only branch users can create requests');
    }

    const request = this.requestRepository.create({
      ...createRequestDto,
      requestingUserId: requestingUser.id,
      status: RequestStatus.REQUEST,
    });

    const savedRequest = await this.requestRepository.save(request);
    return ApiResponseUtil.success(savedRequest, 'Request created successfully');
  }

  async findAll(user: User): Promise<ApiResponse> {
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

    const requests = await query.getMany();
    return ApiResponseUtil.success(requests);
  }

  async findOne(id: number, user: User): Promise<ApiResponse> {
    const request = await this.requestRepository.findOne({
      where: { id, isRemoved: false },
      relations: ['requestingUser', 'adminUser', 'purchase'],
    });

    if (!request) {
      return ApiResponseUtil.error('Request not found');
    }

    // Check permissions
    if (user.role === UserRole.ADMIN && request.adminUserId !== user.id) {
      return ApiResponseUtil.error('Access denied');
    }
    if (user.role === UserRole.BRANCH && request.requestingUserId !== user.id) {
      return ApiResponseUtil.error('Access denied');
    }

    return ApiResponseUtil.success(request);
  }

  async update(id: number, updateRequestDto: UpdateRequestDto, user: User): Promise<ApiResponse> {
    const findResult = await this.findOne(id, user);
    if (!findResult.success) {
      return findResult;
    }
    const request = findResult.data;

    const oldStatus = request.status;
    const newStatus = updateRequestDto.status;

    // Check permissions based on status change
    if (newStatus) {
      if (user.role === UserRole.ADMIN) {
        // Admins can update to Accept, Reject, InTransit
        if (request.adminUserId !== user.id) {
          return ApiResponseUtil.error('Only assigned admin can update request status');
        }
        if (![RequestStatus.ACCEPT, RequestStatus.REJECT, RequestStatus.IN_TRANSIT].includes(newStatus)) {
          return ApiResponseUtil.error('Admins can only set status to Accept, Reject, or InTransit');
        }
      } else if (user.role === UserRole.BRANCH) {
        // Branch users can only update InTransit to Delivered
        if (request.requestingUserId !== user.id) {
          return ApiResponseUtil.error('Access denied');
        }
        if (newStatus !== RequestStatus.DELIVERED || oldStatus !== RequestStatus.IN_TRANSIT) {
          return ApiResponseUtil.error('Branch users can only mark InTransit requests as Delivered');
        }
      } else {
        return ApiResponseUtil.error('Unauthorized to update request status');
      }

      // Validate status transitions
      const validationResult = await this.validateStatusTransition(oldStatus, newStatus, request);
      if (validationResult) {
        return validationResult;
      }
    }

    // Update the request
    Object.assign(request, updateRequestDto);
    const updatedRequest = await this.requestRepository.save(request);

    // Handle inventory adjustments for Delivered status
    if (newStatus === RequestStatus.DELIVERED && oldStatus !== RequestStatus.DELIVERED) {
      await this.handleDelivery(request);
    }

    return ApiResponseUtil.success(updatedRequest, 'Request updated successfully');
  }

  async getAdminsForDropdown(productName?: string, user?: User): Promise<ApiResponse> {
    let admins;

    if (productName) {
      // Case-insensitive matching
      const queryBuilder = this.purchaseRepository
        .createQueryBuilder('purchase')
        .select('purchase.userId', 'userId')
        .where('LOWER(purchase.productName) = LOWER(:productName)', { productName })
        .andWhere('purchase.isRemoved = false');

      if (user) {
        queryBuilder.andWhere('purchase.userId != :currentUserId', { currentUserId: user.id });
      }

      const adminIds = await queryBuilder
        .groupBy('purchase.userId')
        .getRawMany();

      const ids = adminIds.map(a => a.userId);

      if (ids.length === 0) {
        admins = await this.userRepository.withNoDeletedRecord().findAll({
          where: { role: UserRole.ADMIN, ...(user ? { id: Not(user.id) } : {}) },
          select: ['id', 'username'],
        });

        return ApiResponseUtil.success(admins);
      }

      // Return admins who have the product
      admins = await this.userRepository.withNoDeletedRecord().findAll({
        where: {
          role: UserRole.ADMIN,
          id: user
            ? Raw((alias) => `${alias} IN (:...ids) AND ${alias} != :currentUserId`, {
              ids,
              currentUserId: user.id,
            })
            : In(ids),
        },
        select: ['id', 'username'],
      });

    }
    else {
      // When no productName provided → return all admins
      admins = await this.userRepository.withNoDeletedRecord().findAll({
        where: { role: UserRole.ADMIN, ...(user ? { id: Not(user.id) } : {}) },
        select: ['id', 'username'],
      });
    }

    return ApiResponseUtil.success(admins);
  }

  private async validateStatusTransition(oldStatus: RequestStatus, newStatus: RequestStatus, request: Request): Promise<ApiResponse | null> {
    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      [RequestStatus.REQUEST]: [RequestStatus.ACCEPT, RequestStatus.REJECT],
      [RequestStatus.ACCEPT]: [RequestStatus.IN_TRANSIT],
      [RequestStatus.IN_TRANSIT]: [RequestStatus.DELIVERED],
      [RequestStatus.REJECT]: [],
      [RequestStatus.DELIVERED]: [],
    };

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      return ApiResponseUtil.error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    // Additional validation for Accept: check stock availability
    if (newStatus === RequestStatus.ACCEPT) {
      const stockResult = await this.validateStockAvailability(request);
      if (stockResult) {
        return stockResult;
      }
    }

    return null;
  }

  private async validateStockAvailability(request: Request): Promise<ApiResponse | null> {
    // Get admin's inventory for this purchase
    const adminInventory = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .where('purchase.userId = :userId AND purchase.productName = :productName AND purchase.isRemoved = :isRemoved', {
        userId: request.adminUserId,
        productName: request.purchase.productName,
        isRemoved: false,
      })
      .select('SUM(purchase.quantity)', 'totalQuantity')
      .getRawOne();

    const availableQuantity = Number(adminInventory?.totalQuantity || 0);

    if (availableQuantity < request.quantityRequested) {
      return ApiResponseUtil.error(`Insufficient stock. Available: ${availableQuantity}, Requested: ${request.quantityRequested}`);
    }

    return null;
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

  async remove(id: number): Promise<ApiResponse> {
    await this.requestRepository.update(id, { isRemoved: true });
    return ApiResponseUtil.success(null, 'Request removed successfully');
  }
}
