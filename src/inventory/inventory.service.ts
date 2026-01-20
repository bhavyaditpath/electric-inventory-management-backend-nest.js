import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from '../purchase/entities/purchase.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from 'src/shared/enums/role.enum';
import { RequestStatus } from '../shared/enums/request-status.enum';
import { GenericRepository } from '../shared/generic-repository';

export interface InventorySearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class InventoryService {
  private readonly purchaseRepository: GenericRepository<Purchase>;

  constructor(
    @InjectRepository(Purchase)
    repo: Repository<Purchase>,
  ) {
    this.purchaseRepository = new GenericRepository(repo);
  }

  async findAll(user: User, params?: InventorySearchParams) {
    const page = Number(params?.page) || 1;
    const pageSize = Number(params?.pageSize) || 10;
    const search = params?.search?.trim();
    const sortBy = params?.sortBy;
    const sortOrder = params?.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

    return this.findWithPagination(user, page, pageSize, search, sortBy, sortOrder);
  }

  private async findWithPagination(
    user: User,
    page: number,
    pageSize: number,
    search?: string,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'ASC',
  ) {
    const qb = this.purchaseRepository['repo']
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.branch', 'branch')
      .leftJoin('purchase.user', 'user')
      .leftJoin('requests', 'req', 'req.purchaseId = purchase.id AND req.isRemoved = false')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

    qb.andWhere('purchase.branchId = :branchId', { branchId: user.branchId })
      .andWhere('(req.id IS NULL OR req.status = :delivered)', {
        delivered: RequestStatus.DELIVERED,
      });

    if (search) {
      qb.andWhere(
        `(LOWER(purchase.productName) LIKE :s OR LOWER(purchase.brand) LIKE :s)`,
        {
          s: `%${search.toLowerCase()}%`,
        }
      );
    }

    const rows = await qb.getMany();

    const inventoryMap = new Map();

    for (const r of rows) {
      const key = `${r.productName}-${r.brand}-${r.branchId}`;

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          id: r.id,
          productName: r.productName,
          brand: r.brand,
          currentQuantity: 0,
          unit: r.unit,
          lowStockThreshold: r.lowStockThreshold,
          branchId: r.branchId,
          branch: r.branch ? { id: r.branch.id, name: r.branch.name } : null,
          lastPurchaseDate: r.createdAt,
          totalPurchased: 0,
        });
      }

      const item = inventoryMap.get(key);
      item.currentQuantity += Number(r.quantity);
      item.totalPurchased += Number(r.quantity);

      if (r.createdAt > item.lastPurchaseDate) {
        item.lastPurchaseDate = r.createdAt;
      }
    }

    let items = Array.from(inventoryMap.values());

    // Sort the aggregated items
    const validSort = ['productName', 'brand', 'quantity', 'unit', 'lowStockThreshold', 'createdAt'];
    const sortField = validSort.includes(sortBy || '') ? sortBy : 'productName';

    items.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a];
      let bVal: any = b[sortField as keyof typeof b];

      let cmp: number;
      if (sortField === 'createdAt') {
        cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = Number(aVal) - Number(bVal);
      }
      return sortOrder === 'DESC' ? -cmp : cmp;
    });

    const total = items.length;
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }


  async getStockSummary(user: User, search?: string) {
    const qb = this.purchaseRepository['repo']
      .createQueryBuilder('purchase')
      .leftJoin('purchase.branch', 'branch')
      .leftJoin('purchase.user', 'user')
      .leftJoin('requests', 'req', 'req.purchaseId = purchase.id AND req.isRemoved = false')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

    qb.andWhere('purchase.branchId = :branchId', { branchId: user.branchId })
      .andWhere('(req.id IS NULL OR req.status = :delivered)', {
        delivered: RequestStatus.DELIVERED,
      });

    if (search) {
      qb.andWhere(
        `(LOWER(purchase.productName) LIKE :s OR LOWER(purchase.brand) LIKE :s)`,
        { s: `%${search.toLowerCase()}%` }
      );
    }

    const rows = await qb.getMany();

    const inventoryMap = new Map<string, any>();

    for (const r of rows) {
      const key = `${r.productName}-${r.brand}-${r.branchId}`;

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          currentQuantity: 0,
          lowStockThreshold: r.lowStockThreshold,
        });
      }

      const item = inventoryMap.get(key);
      item.currentQuantity += Number(r.quantity);
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
      low,
      warning,
      good,
    };
  }
}