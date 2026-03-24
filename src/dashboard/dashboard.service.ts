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
import { PurchaseTrendPeriod, PurchaseTrendQueryDto } from './dto/purchase-trend-query.dto';
import { UserRole } from '../shared/enums/role.enum';
import { SalesPurchaseTrendQueryDto } from './dto/sales-purchase-trend-query.dto';
import { StockHealthQueryDto } from './dto/stock-health-query.dto';

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
  ) { }

  // Admin Dashboard APIs
  async getTotalInventory(user: User): Promise<number> {
    return await this.purchaseRepository.count({
      where: {
        isRemoved: false,
        branchId: user.branchId,
      },
    });
  }

  async getActiveBranches(): Promise<number> {
    return await this.branchRepository.count({
      where: { isRemoved: false },
    });
  }

  async getMonthlySales(user: User): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .select('SUM(request.quantityRequested * purchase.pricePerUnit)', 'total')
      .where('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('purchase.branchId = :branchId', { branchId: user.branchId })
      .andWhere('request.createdAt >= :start', { start: startOfMonth })
      .andWhere('request.createdAt <= :end', { end: endOfMonth });

    const result = await qb.getRawOne();
    return parseFloat(result.total) || 0;
  }

  async getPendingRequests(user: User): Promise<number> {
    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .where('request.status = :status', { status: RequestStatus.REQUEST })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('purchase.branchId = :branchId', { branchId: user.branchId });

    return await qb.getCount();
  }

  // Branch Dashboard APIs
  async getCurrentStock(user: User): Promise<number> {
    if (!user || !user.branchId) return 0;

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .select('SUM(request.quantityRequested)', 'total')
      .where('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
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

  async getActiveAlertsList(userId: number): Promise<StockAlert[]> {
    const user = await this.userRepository.findOne({ where: { id: userId, isRemoved: false } });
    if (!user || !user.branchId) return [];

    return await this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.branch', 'branch')
      .select([
        'alert.id',
        'alert.createdAt',
        'alert.itemName',
        'alert.currentStock',
        'alert.shortage',
        'alert.status',
        'alert.branchId',
        'branch.id',
        'branch.name',
      ])
      .where('alert.status = :status', { status: AlertStatus.ACTIVE })
      .andWhere('alert.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('alert.branchId = :branchId', { branchId: user.branchId })
      .getMany();
  }

  async getPendingOrders(user: User): Promise<number> {
    return await this.requestRepository.count({
      where: {
        status: RequestStatus.REQUEST,
        isRemoved: false,
        requestingUserId: user.id,
      },
    });
  }

  async getTodaysbuys(user: User): Promise<number> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .select('SUM(purchase.totalPrice)', 'total')
      .where('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('purchase.branchId = :branchId', { branchId: user.branchId })
      .andWhere('request.createdAt >= :start', { start: startOfDay })
      .andWhere('request.createdAt <= :end', { end: endOfDay });

    const result = await qb.getRawOne();
    return parseFloat(result.total) || 0;
  }

  async getPurchaseTrend(user: User, query: PurchaseTrendQueryDto) {
    const period = query.period ?? PurchaseTrendPeriod.MONTH;
    const bucketExpr = this.getBucketExpression(period);
    const branchId = user.role === UserRole.ADMIN ? query.branchId : user.branchId;

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select(`${bucketExpr}`, 'bucket')
      .addSelect('SUM(purchase.quantity)', 'totalQuantity')
      .addSelect('SUM(purchase.totalPrice)', 'totalValue')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

    if (branchId) {
      qb.andWhere('purchase.branchId = :branchId', { branchId });
    }

    if (query.productName?.trim()) {
      qb.andWhere('LOWER(purchase.productName) = LOWER(:productName)', {
        productName: query.productName.trim(),
      });
    }

    qb.groupBy('bucket').orderBy('bucket', 'ASC');

    const rows = await qb.getRawMany<{
      bucket: string;
      totalQuantity: string;
      totalValue: string;
    }>();

    const labels = rows.map((row) => this.formatBucketLabel(row.bucket, period));
    const quantityData = rows.map((row) => Number(row.totalQuantity || 0));
    const valueData = rows.map((row) => Number(row.totalValue || 0));

    return {
      period,
      filters: {
        branchId: branchId ?? null,
        productName: query.productName?.trim() || null,
      },
      labels,
      datasets: [
        {
          key: 'quantity',
          label: 'Purchased Quantity',
          data: quantityData,
        },
        {
          key: 'value',
          label: 'Purchase Value',
          data: valueData,
        },
      ],
      totals: {
        totalQuantity: quantityData.reduce((sum, val) => sum + val, 0),
        totalValue: valueData.reduce((sum, val) => sum + val, 0),
      },
    };
  }

  private getBucketExpression(period: PurchaseTrendPeriod): string {
    if (period === PurchaseTrendPeriod.WEEK) return `DATE_TRUNC('day', purchase.createdAt)`;
    if (period === PurchaseTrendPeriod.YEAR) return `DATE_TRUNC('month', purchase.createdAt)`;
    return `DATE_TRUNC('week', purchase.createdAt)`;
  }

  private formatBucketLabel(bucket: string, period: PurchaseTrendPeriod): string {
    const date = new Date(bucket);
    if (period === PurchaseTrendPeriod.WEEK) {
      return date.toISOString().split('T')[0];
    }
    if (period === PurchaseTrendPeriod.YEAR) {
      return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }
    return date.toISOString().split('T')[0];
  }

  async getSalesVsPurchaseTrend(user: User, query: SalesPurchaseTrendQueryDto) {
    const period = query.period ?? PurchaseTrendPeriod.MONTH;
    const bucketExpr = this.getBucketExpression(period);
    const branchId = user.role === UserRole.ADMIN ? query.branchId : user.branchId;
    const productName = query.productName?.trim();

    const purchaseQb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select(`${bucketExpr}`, 'bucket')
      .addSelect('SUM(purchase.totalPrice)', 'purchaseValue')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

    if (branchId) {
      purchaseQb.andWhere('purchase.branchId = :branchId', { branchId });
    }
    if (productName) {
      purchaseQb.andWhere('LOWER(purchase.productName) = LOWER(:productName)', { productName });
    }

    purchaseQb.groupBy('bucket').orderBy('bucket', 'ASC');

    const salesQb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoin('request.purchase', 'purchase')
      .select(`DATE_TRUNC('${period === PurchaseTrendPeriod.YEAR ? 'month' : period === PurchaseTrendPeriod.WEEK ? 'day' : 'week'}', request.createdAt)`, 'bucket')
      .addSelect('SUM(request.quantityRequested * purchase.pricePerUnit)', 'salesValue')
      .where('request.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('request.status = :status', { status: RequestStatus.DELIVERED })
      .andWhere('purchase.isRemoved = :purchaseRemoved', { purchaseRemoved: false });

    if (branchId) {
      salesQb.andWhere('purchase.branchId = :branchId', { branchId });
    }
    if (productName) {
      salesQb.andWhere('LOWER(purchase.productName) = LOWER(:productName)', { productName });
    }

    salesQb.groupBy('bucket').orderBy('bucket', 'ASC');

    const [purchaseRows, salesRows] = await Promise.all([
      purchaseQb.getRawMany<{ bucket: string; purchaseValue: string }>(),
      salesQb.getRawMany<{ bucket: string; salesValue: string }>(),
    ]);

    const purchaseMap = new Map<string, number>();
    for (const row of purchaseRows) {
      purchaseMap.set(row.bucket, Number(row.purchaseValue || 0));
    }

    const salesMap = new Map<string, number>();
    for (const row of salesRows) {
      salesMap.set(row.bucket, Number(row.salesValue || 0));
    }

    const allBuckets = Array.from(new Set([...purchaseMap.keys(), ...salesMap.keys()])).sort();
    const labels = allBuckets.map((bucket) => this.formatBucketLabel(bucket, period));
    const purchaseData = allBuckets.map((bucket) => purchaseMap.get(bucket) ?? 0);
    const salesData = allBuckets.map((bucket) => salesMap.get(bucket) ?? 0);

    return {
      period,
      filters: {
        branchId: branchId ?? null,
        productName: productName || null,
      },
      labels,
      datasets: [
        {
          key: 'purchaseValue',
          label: 'Purchase Value',
          data: purchaseData,
        },
        {
          key: 'salesValue',
          label: 'Sales Value',
          data: salesData,
        },
      ],
      totals: {
        totalPurchaseValue: purchaseData.reduce((sum, val) => sum + val, 0),
        totalSalesValue: salesData.reduce((sum, val) => sum + val, 0),
      },
    };
  }

  async getStockHealthDistribution(user: User, query: StockHealthQueryDto) {
    const branchId = user.role === UserRole.ADMIN ? query.branchId : user.branchId;

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('requests', 'req', 'req.purchaseId = purchase.id AND req.isRemoved = false')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('(req.id IS NULL OR req.status = :delivered)', {
        delivered: RequestStatus.DELIVERED,
      });

    if (branchId) {
      qb.andWhere('purchase.branchId = :branchId', { branchId });
    }

    if (query.search?.trim()) {
      qb.andWhere('(LOWER(purchase.productName) LIKE :search OR LOWER(purchase.brand) LIKE :search)', {
        search: `%${query.search.trim().toLowerCase()}%`,
      });
    }

    const rows = await qb.getMany();
    const inventoryMap = new Map<string, { currentQuantity: number; lowStockThreshold: number }>();

    for (const row of rows) {
      const key = `${row.productName}-${row.brand}-${row.branchId}`;
      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          currentQuantity: 0,
          lowStockThreshold: Number(row.lowStockThreshold) || 0,
        });
      }
      const item = inventoryMap.get(key)!;
      item.currentQuantity += Number(row.quantity);
    }

    let low = 0;
    let warning = 0;
    let good = 0;

    for (const item of inventoryMap.values()) {
      if (item.currentQuantity <= item.lowStockThreshold) {
        low++;
      } else if (item.currentQuantity <= item.lowStockThreshold * 2) {
        warning++;
      } else {
        good++;
      }
    }

    return {
      filters: {
        branchId: branchId ?? null,
        search: query.search?.trim() || null,
      },
      labels: ['Low', 'Warning', 'Good'],
      datasets: [
        {
          key: 'stockHealth',
          label: 'Stock Health Distribution',
          data: [low, warning, good],
        },
      ],
      counts: { low, warning, good },
      totalProducts: low + warning + good,
    };
  }
}
