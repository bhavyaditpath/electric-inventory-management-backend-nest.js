import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from '../purchase/entities/purchase.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from 'src/shared/enums/role.enum';
import { RequestStatus } from '../shared/enums/request-status.enum';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
  ) { }

  async findAll(user: User) {
    let query = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.user', 'user')
      .leftJoin('purchase.branch', 'branch')
      .leftJoin('requests', 'req', 'req.purchaseId = purchase.id AND req.isRemoved = false')
      .select([
        'purchase.id',
        'purchase.productName',
        'purchase.quantity',
        'purchase.unit',
        'purchase.lowStockThreshold',
        'purchase.brand',
        'purchase.createdAt',
        'purchase.branchId',
        'purchase.userId',
        'user.id',
        'user.username',
        'user.role',

        'branch.id',  
        'branch.name',
      ])
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

    if (user.role === UserRole.ADMIN) {
      query = query.andWhere('purchase.createdBy = :userId', {
        userId: user.id,
      });
    } else if (user.role === UserRole.BRANCH) {
      query = query.andWhere('purchase.createdBy = :userId', {
        userId: user.id,
      })
      .andWhere('(req.id IS NULL OR req.status = :deliveredStatus)', { deliveredStatus: RequestStatus.DELIVERED });
    }

    const rows = await query.getRawMany();
    const inventoryMap = new Map();

    rows.forEach((r) => {
      const productName = r.purchase_productName;
      const branchId = r.purchase_branchId;
      const brand = r.purchase_brand;

      // Group uniquely by product + brand + branch
      const key = `${productName}-${brand}-${branchId}`;

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          id: r.purchase_id,
          productName: productName,
          brand: brand,
          currentQuantity: 0,
          unit: r.purchase_unit,
          lowStockThreshold: r.purchase_lowStockThreshold,
          branchId: branchId,
          branch: {
            id: r.branch_id,
            name: r.branch_name,
          },
          lastPurchaseDate: r.purchase_createdAt,
          totalPurchased: 0,
        });
      }

      const item = inventoryMap.get(key);

      item.currentQuantity += Number(r.purchase_quantity);
      item.totalPurchased += Number(r.purchase_quantity);

      if (r.purchase_createdAt > item.lastPurchaseDate) {
        item.lastPurchaseDate = r.purchase_createdAt;
      }
    });


    return Array.from(inventoryMap.values());
  }
}
