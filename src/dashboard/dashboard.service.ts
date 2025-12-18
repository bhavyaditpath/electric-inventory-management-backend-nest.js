import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from '../purchase/entities/purchase.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Request } from '../request/entities/request.entity';
import { StockAlert } from '../alert/entities/alert.entity';
import { User } from '../user/entities/user.entity';
import { RequestStatus } from '../shared/enums/request-status.enum';
import { AlertStatus } from '../shared/enums/alert-status.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(StockAlert)
    private alertRepository: Repository<StockAlert>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Admin Dashboard APIs
  async getTotalInventory(userId: number): Promise<number> {
    return await this.purchaseRepository.count({
      where: {
        isRemoved: false,
        createdBy: userId,
      },
    });
  }

  async getActiveBranches(): Promise<number> {
    return await this.branchRepository.count({
      where: { isRemoved: false },
    });
  }

  async getMonthlySales(userId: number): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .select('SUM(request.quantityRequested * purchase.pricePerUnit)', 'total')
      .where('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('request.adminUserId = :userId', { userId })
      .andWhere('request.createdAt >= :start', { start: startOfMonth })
      .andWhere('request.createdAt <= :end', { end: endOfMonth });

    const result = await qb.getRawOne();
    return parseFloat(result.total) || 0;
  }

  async getPendingRequests(userId: number): Promise<number> {
    return await this.requestRepository.count({
      where: {
        status: RequestStatus.REQUEST,
        isRemoved: false,
        adminUserId: userId,
      },
    });
  }

  // Branch Dashboard APIs
  async getCurrentStock(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId, isRemoved: false } });
    if (!user || !user.branchId) return 0;

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select('SUM(purchase.quantity)', 'total')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('purchase.branchId = :branchId', { branchId: user.branchId });

    const result = await qb.getRawOne();
    return parseFloat(result.total) || 0;
  }

  async getActiveAlerts(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId, isRemoved: false } });
    if (!user || !user.branchId) return 0;

    return await this.alertRepository.count({
      where: {
        status: AlertStatus.ACTIVE,
        branchId: user.branchId,
        isRemoved: false,
      },
    });
  }

  async getPendingOrders(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId, isRemoved: false } });
    if (!user || !user.branchId) return 0;

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.requestingUser', 'user')
      .where('request.status = :status', { status: RequestStatus.REQUEST })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('user.branchId = :branchId', { branchId: user.branchId });

    return await qb.getCount();
  }

  async getTodaysbuys(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId, isRemoved: false } });
    if (!user || !user.branchId) return 0;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.requestingUser', 'user')
      .leftJoin('request.purchase', 'purchase')
      .select('SUM(request.quantityRequested * purchase.pricePerUnit)', 'total')
      .where('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('user.branchId = :branchId', { branchId: user.branchId })
      .andWhere('request.createdAt >= :start', { start: startOfDay })
      .andWhere('request.createdAt <= :end', { end: endOfDay });

    const result = await qb.getRawOne();
    return parseFloat(result.total) || 0;
  }
}