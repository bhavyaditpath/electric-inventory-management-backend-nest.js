import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { BranchService } from '../branch/branch.service';
import { PurchaseService } from '../purchase/purchase.service';
import { UserRole } from '../shared/enums/role.enum';

@Injectable()
export class SeederService {
  constructor(
    private readonly userService: UserService,
    private readonly branchService: BranchService,
    private readonly purchaseService: PurchaseService,
  ) {}

  async seed() {
    Logger.log('🌱 Starting DB Seed...');

    // SEED BRANCHES
    const branches = [
      { name: 'Main Branch', address: '123 Main St', phone: '555-0100' },
      { name: 'Downtown Branch', address: '456 Downtown Ave', phone: '555-0200' },
      { name: 'East Branch', address: '789 East Road', phone: '555-0300' },
    ];

    for (const b of branches) {
      const exist = await this.branchService.findByName(b.name);
      if (!exist) {
        await this.branchService.create(b);
        Logger.log(`✔ Branch created: ${b.name}`);
      }
    }

    // SEED USERS
    const users = [
      {
        username: 'admin',
        password: 'admin',
        role: UserRole.ADMIN,
        branchName: 'Main Branch',
      },
      {
        username: 'branch2',
        password: 'branch2',
        role: UserRole.BRANCH,
        branchName: 'Downtown Branch',
      },
      {
        username: 'eastuser',
        password: 'east',
        role: UserRole.BRANCH,
        branchName: 'East Branch',
      },
    ];

    for (const u of users) {
      const exist = await this.userService.findByUsername(u.username);
      if (!exist) {
        await this.userService.create(u);
        Logger.log(`✔ User created: ${u.username}`);
      }
    }

    // SEED PURCHASES (Dummy Data)
    const admin = await this.userService.findByUsername('admin');
    const branch2 = await this.userService.findByUsername('branch2');

    const samplePurchases = [
      {
        productName: 'Switch Box',
        quantity: 10,
        unit: 'pcs',
        pricePerUnit: 20,
        totalPrice: 200,
        lowStockThreshold: 5,
        brand: 'Havells',
        userId: admin?.id,
      },
      {
        productName: 'Wire Coil',
        quantity: 2,
        unit: 'rolls',
        pricePerUnit: 150,
        totalPrice: 300,
        lowStockThreshold: 1,
        brand: 'Finolex',
        userId: admin?.id,
      },
      {
        productName: 'Fan Motor',
        quantity: 3,
        unit: 'pcs',
        pricePerUnit: 800,
        totalPrice: 2400,
        lowStockThreshold: 1,
        brand: 'Usha',
        userId: branch2?.id,
      },
    ];

    for (const p of samplePurchases) {
      const exists = await this.purchaseService.findDuplicate(p.productName, p.userId!);
      if (!exists) {
        await this.purchaseService.create(p, p.userId!);
        Logger.log(`✔ Purchase created: ${p.productName}`);
      }
    }

    Logger.log('🌱 Database Seeding Completed.');
  }
}
