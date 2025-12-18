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
import { AlertService } from '../alert/alert.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../shared/enums/notification-type.enum';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

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

    private alertService: AlertService,
    private notificationService: NotificationService,
  ) {
    this.userRepository = new GenericRepository(userRepo);
  }

  async create(createRequestDto: CreateRequestDto, requestingUser: User): Promise<ApiResponse> {
    const adminUser = await this.userRepository
      .withNoDeletedRecord()
      .findOne({ id: createRequestDto.adminUserId, role: UserRole.ADMIN });

    if (!adminUser) return ApiResponseUtil.error('Invalid admin user');

    if (requestingUser.role !== UserRole.BRANCH)
      return ApiResponseUtil.error('Only branch users can create requests');

    const request = this.requestRepository.create({
      ...createRequestDto,
      requestingUserId: requestingUser.id,
      status: RequestStatus.REQUEST,
    });

    const saved = await this.requestRepository.save(request);
    // Create notifications for new request
    await this.createRequestCreationNotifications(saved, requestingUser);

    return ApiResponseUtil.success(saved, 'Request created successfully');
  }

  async findAll(user: User, params?: PaginationQueryDto): Promise<ApiResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;

    const query = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requestingUser', 'requestingUser')
      .leftJoinAndSelect('request.adminUser', 'adminUser')
      .leftJoinAndSelect('request.purchase', 'purchase')
      .where('request.isRemoved = :removed', { removed: false });

    if (user.role === UserRole.ADMIN) {
      query.andWhere('request.adminUserId = :id', { id: user.id });
    } else if (user.role === UserRole.BRANCH) {
      query.andWhere('request.requestingUserId = :id', { id: user.id });
    }

    // Search functionality
    if (params?.search) {
      const searchTerm = `%${params.search}%`;
      query.andWhere(
        '(CAST(request.status AS TEXT) ILIKE :search OR ' +
        'request.notes ILIKE :search OR ' +
        'purchase.productName ILIKE :search )',
        { search: searchTerm }
      );
    }

    // Sorting functionality
    const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'quantityRequested'];
    if (params?.sortBy && allowedSortFields.includes(params.sortBy)) {
      query.orderBy(`request.${params.sortBy}`, params.sortOrder || 'ASC');
    } else {
      // Default sort by createdAt DESC
      query.orderBy('request.createdAt', 'DESC');
    }

    const offset = (page - 1) * pageSize;
    query.skip(offset).take(pageSize);

    const [items, total] = await query.getManyAndCount();

    const result = {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return ApiResponseUtil.success(result);
  }

  async findOne(id: number, user: User): Promise<ApiResponse> {
    const req = await this.requestRepository.findOne({
      where: { id, isRemoved: false },
      relations: ['requestingUser', 'adminUser', 'purchase'],
    });

    if (!req) return ApiResponseUtil.error('Request not found');

    if (user.role === UserRole.ADMIN && req.adminUserId !== user.id)
      return ApiResponseUtil.error('Access denied');

    if (user.role === UserRole.BRANCH && req.requestingUserId !== user.id)
      return ApiResponseUtil.error('Access denied');

    return ApiResponseUtil.success(req);
  }

  async update(id: number, dto: UpdateRequestDto, user: User): Promise<ApiResponse> {
    const found = await this.findOne(id, user);
    if (!found.success) return found;

    const request = found.data as Request;

    const oldStatus = request.status;
    const newStatus = dto.status;

    // Permission checks
    if (newStatus) {
      if (user.role === UserRole.ADMIN) {
        if (request.adminUserId !== user.id)
          return ApiResponseUtil.error('Only assigned admin can update this request');

        if (![RequestStatus.ACCEPT, RequestStatus.REJECT, RequestStatus.IN_TRANSIT].includes(newStatus))
          return ApiResponseUtil.error('Admins can only set Accept, Reject, or InTransit');
      } else if (user.role === UserRole.BRANCH) {
        if (request.requestingUserId !== user.id)
          return ApiResponseUtil.error('Access denied');

        if (!(newStatus === RequestStatus.DELIVERED && oldStatus === RequestStatus.IN_TRANSIT))
          return ApiResponseUtil.error('Branch can only mark InTransit → Delivered');
      }

      const transitionCheck = await this.validateStatusTransition(oldStatus, newStatus, request);
      if (transitionCheck) return transitionCheck;
    }

    // Apply update
    Object.assign(request, dto);
    const updated = await this.requestRepository.save(request);

    // Create notification for status change
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      await this.createRequestStatusNotification(request, oldStatus, newStatus, user);
    }

    // FIFO deduction WHEN ACCEPTED
    if (newStatus === RequestStatus.ACCEPT && oldStatus !== RequestStatus.ACCEPT) {
      await this.deductStockFIFO(request);

      // After FIFO deduction, regenerate alerts for admin's branch (if available)
      const adminBranchId = request.adminUser?.branchId ?? request.purchase?.branchId;
      if (adminBranchId && Number(adminBranchId) > 0) {
        try {
          await this.alertService.generateAlertsForBranch(Number(adminBranchId));
        } catch (err) {
          console.error('Failed to regenerate alerts after FIFO:', err);
        }
      } else {
        console.warn('Admin branchId missing; skipping alert regeneration for request id:', request.id);
      }
    }

    // Delivery: give stock to branch (keeps previous behavior)
    if (newStatus === RequestStatus.DELIVERED && oldStatus !== RequestStatus.DELIVERED) {
      await this.handleDelivery(request);
    }

    return ApiResponseUtil.success(updated, 'Request updated successfully');
  }

  // VALIDATIONS -------------------------------
  private async validateStatusTransition(
    oldStatus: RequestStatus,
    newStatus: RequestStatus,
    request: Request,
  ): Promise<ApiResponse | null> {
    const valid: Record<RequestStatus, RequestStatus[]> = {
      Request: [RequestStatus.ACCEPT, RequestStatus.REJECT],
      Accept: [RequestStatus.IN_TRANSIT],
      InTransit: [RequestStatus.DELIVERED],
      Reject: [],
      Delivered: [],
    };

    if (!valid[oldStatus]?.includes(newStatus))
      return ApiResponseUtil.error(`Invalid transition ${oldStatus} → ${newStatus}`);

    if (newStatus === RequestStatus.ACCEPT) {
      const stockCheck = await this.validateStockAvailability(request);
      if (stockCheck) return stockCheck;
    }

    return null;
  }

  private async validateStockAvailability(request: Request): Promise<ApiResponse | null> {
    const result = await this.purchaseRepository
      .createQueryBuilder('p')
      .select('SUM(p.quantity)', 'total')
      .where('p.userId = :u AND LOWER(p.productName) = LOWER(:p) AND p.isRemoved = false', {
        u: request.adminUserId,
        p: request.purchase.productName,
      })
      .getRawOne();

    const available = Number(result?.total || 0);
    if (available < request.quantityRequested)
      return ApiResponseUtil.error(`Not enough stock. Available: ${available}, Requested: ${request.quantityRequested}`);

    return null;
  }

  private async deductStockFIFO(request: Request) {
    let needed = Number(request.quantityRequested);

    const purchases = await this.purchaseRepository
      .createQueryBuilder('p')
      .where('p.userId = :uid', { uid: request.adminUserId })
      .andWhere('LOWER(p.productName) = LOWER(:name)', {
        name: request.purchase.productName,
      })
      .andWhere('p.isRemoved = false')
      .orderBy('p.createdAt', 'ASC')
      .getMany();

    for (const p of purchases) {
      if (needed <= 0) break;

      const available = Number(p.quantity);

      if (available >= needed) {
        p.quantity = available - needed;
        p.totalPrice = p.quantity * (p.pricePerUnit || 0);
        if (p.quantity <= 0) p.isRemoved = true;
        await this.purchaseRepository.save(p);
        needed = 0;
      } else {
        needed -= available;
        p.quantity = 0;
        p.totalPrice = 0;
        p.isRemoved = true;
        await this.purchaseRepository.save(p);
      }
    }

    if (needed > 0) {
      throw new Error('FIFO mismatch: insufficient stock after validation.');
    }

    const stockSummary = await this.purchaseRepository
      .createQueryBuilder('p')
      .select('SUM(p.quantity)', 'total')
      .addSelect('p.lowStockThreshold', 'minStock')
      .where('p.userId = :uid', { uid: request.adminUserId })
      .andWhere('LOWER(p.productName) = LOWER(:name)', {
        name: request.purchase.productName,
      })
      .andWhere('p.isRemoved = false')
      .groupBy('p.lowStockThreshold')
      .getRawOne();

    const finalStock = Number(stockSummary?.total ?? 0);
    const minStock = Number(stockSummary?.minStock ?? request.purchase.lowStockThreshold);

    const branchId = request.adminUser.branchId;
    await this.alertService.updateProductAlert(
      request.purchase.productName,
      request.purchase.brand,
      branchId,
      finalStock,
      minStock
    );
  }

  // DELIVERED: BRANCH GETS STOCK -----------------
  private async handleDelivery(request: Request) {
    const branchPurchase = request.purchase;
    branchPurchase.quantity = request.quantityRequested;
    branchPurchase.totalPrice =
      request.quantityRequested * branchPurchase.pricePerUnit;

    await this.purchaseRepository.save(branchPurchase);
  }

  // ADMIN DROPDOWN ------------------------------
  async getAdminsForDropdown(productName?: string, user?: User): Promise<ApiResponse> {
    let admins;

    if (productName) {
      const qb = this.purchaseRepository
        .createQueryBuilder('p')
        .select('p.userId', 'userId')
        .where('LOWER(p.productName) = LOWER(:name)', { name: productName })
        .andWhere('p.isRemoved = false');

      if (user) {
        qb.andWhere('p.userId != :uid', { uid: user.id });
      }

      const rows = await qb.groupBy('p.userId').getRawMany();
      const ids = rows.map(r => r.userId);

      if (ids.length === 0) {
        admins = await this.userRepository.withNoDeletedRecord().findAll({
          where: { role: UserRole.ADMIN },
          select: ['id', 'username'],
        });

        return ApiResponseUtil.success(admins);
      }

      admins = await this.userRepository.withNoDeletedRecord().findAll({
        where: {
          role: UserRole.ADMIN,
          id: user
            ? Raw(alias => `${alias} IN (:...ids) AND ${alias} != :uid`, {
              ids,
              uid: user.id,
            })
            : In(ids),
        },
        select: ['id', 'username'],
      });
    } else {
      admins = await this.userRepository.withNoDeletedRecord().findAll({
        where: { role: UserRole.ADMIN },
        select: ['id', 'username'],
      });
    }

    return ApiResponseUtil.success(admins);
  }

  async remove(id: number): Promise<ApiResponse> {
    await this.requestRepository.update(id, { isRemoved: true });
    return ApiResponseUtil.success(null, 'Request removed successfully');
  }

  private async createRequestStatusNotification(
    request: Request,
    oldStatus: RequestStatus,
    newStatus: RequestStatus,
    user: User
  ): Promise<void> {
    try {
      let title = '';
      let message = '';
      let notificationType = NotificationType.USER;
      let targetUserId: number | undefined;
      let targetBranchId: number | undefined;

      switch (newStatus) {
        case RequestStatus.ACCEPT:
          title = 'Request Accepted';
          message = `Your request for ${request.purchase.productName} (${request.quantityRequested} units) has been accepted.`;
          notificationType = NotificationType.USER;
          targetUserId = request.requestingUserId;
          break;

        case RequestStatus.REJECT:
          title = 'Request Rejected';
          message = `Your request for ${request.purchase.productName} (${request.quantityRequested} units) has been rejected.`;
          notificationType = NotificationType.USER;
          targetUserId = request.requestingUserId;
          break;

        case RequestStatus.IN_TRANSIT:
          title = 'Request In Transit';
          message = `Your request for ${request.purchase.productName} (${request.quantityRequested} units) is now in transit.`;
          notificationType = NotificationType.USER;
          targetUserId = request.requestingUserId;
          break;

        case RequestStatus.DELIVERED:
          title = 'Request Delivered';
          message = `Your request for ${request.purchase.productName} (${request.quantityRequested} units) has been delivered.`;
          notificationType = NotificationType.USER;
          targetUserId = request.requestingUserId;
          break;

        default:
          return; // No notification for other status changes
      }

      await this.notificationService.create({
        title,
        message,
        type: notificationType,
        userId: targetUserId,
        branchId: targetBranchId,
      });
    } catch (error) {
      console.error('Failed to create request status notification:', error);
    }
  }

  private async createRequestCreationNotifications(request: Request, requestingUser: User): Promise<void> {
    try {
      // Create personal confirmation for the user who submitted the request
      const userTitle = 'Request Submitted Successfully';
      const userMessage = `Your request for ${request.purchase.productName} (${request.quantityRequested} units) has been submitted successfully and is pending approval.`;

      await this.notificationService.create({
        title: userTitle,
        message: userMessage,
        type: NotificationType.USER,
        userId: requestingUser.id,
      });

      // Create notification for the admin user
      const adminTitle = 'New Request Submitted';
      const adminMessage = `${requestingUser.username} has submitted a request for ${request.purchase.productName} (${request.quantityRequested} units).`;

      await this.notificationService.create({
        title: adminTitle,
        message: adminMessage,
        type: NotificationType.USER,
        userId: request.adminUserId,
      });
    } catch (error) {
      console.error('Failed to create request creation notifications:', error);
    }
  }
}
