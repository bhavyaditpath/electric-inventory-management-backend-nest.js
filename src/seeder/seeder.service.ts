import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { BranchService } from '../branch/branch.service';
import { PurchaseService } from '../purchase/purchase.service';
import { AlertService } from '../alert/alert.service';
import { UserRole } from '../shared/enums/role.enum';

@Injectable()
export class SeederService {
  constructor(
    private readonly userService: UserService,
    private readonly branchService: BranchService,
    private readonly purchaseService: PurchaseService,
    private readonly alertService: AlertService,
  ) {}

  async seed() {
    Logger.log('🌱 Starting DB Seed...');

    // SEED BRANCHES
    const branches = [
      { name: 'Head Office', address: '100 Head Office St', phone: '555-0000' },
      { name: 'Main Branch', address: '123 Main St', phone: '555-0100' },
      { name: 'Downtown Branch', address: '456 Downtown Ave', phone: '555-0200' },
      { name: 'East Branch', address: '789 East Road', phone: '555-0300' },
      { name: 'West Branch', address: '321 West Blvd', phone: '555-0400' },
      { name: 'North Branch', address: '654 North Ln', phone: '555-0500' },
      { name: 'South Branch', address: '987 South St', phone: '555-0600' },
      { name: 'Central Branch', address: '147 Central Ave', phone: '555-0700' },
      { name: 'Industrial Branch', address: '258 Industrial Rd', phone: '555-0800' },
      { name: 'Residential Branch', address: '369 Residential Dr', phone: '555-0900' },
      { name: 'Commercial Branch', address: '741 Commercial Blvd', phone: '555-1000' },
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
      // Admins - all in Head Office
      { username: 'admin1@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin2@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin3@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin4@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin5@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin6@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin7@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin8@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin9@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      { username: 'admin10@yopmail.com', password: 'admin', role: UserRole.ADMIN, branchName: 'Head Office' },
      // Branch users - each in their own branch
      { username: 'branch1@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Main Branch' },
      { username: 'branch2@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Downtown Branch' },
      { username: 'branch3@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'East Branch' },
      { username: 'branch4@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'West Branch' },
      { username: 'branch5@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'North Branch' },
      { username: 'branch6@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'South Branch' },
      { username: 'branch7@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Central Branch' },
      { username: 'branch8@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Industrial Branch' },
      { username: 'branch9@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Residential Branch' },
      { username: 'branch10@yopmail.com', password: 'branch', role: UserRole.BRANCH, branchName: 'Commercial Branch' },
    ];

    for (const u of users) {
      const exist = await this.userService.findByUsername(u.username);
      if (!exist) {
        await this.userService.create(u);
        Logger.log(`✔ User created: ${u.username}`);
      }
    }

    // SEED PURCHASES (Dummy Data)
    const admin1 = await this.userService.findByUsername('admin1@yopmail.com');
    const admin2 = await this.userService.findByUsername('admin2@yopmail.com');
    const branch1 = await this.userService.findByUsername('branch1@yopmail.com');
    const branch2 = await this.userService.findByUsername('branch2@yopmail.com');
    const branch3 = await this.userService.findByUsername('branch3@yopmail.com');

    const samplePurchases = [
      { productName: 'Switch Box', quantity: 10, unit: 'pcs', pricePerUnit: 20, totalPrice: 200, lowStockThreshold: 5, brand: 'Havells', userId: admin1?.id },
      { productName: 'Wire Coil', quantity: 2, unit: 'rolls', pricePerUnit: 150, totalPrice: 300, lowStockThreshold: 1, brand: 'Finolex', userId: admin1?.id },
      { productName: 'Fan Motor', quantity: 3, unit: 'pcs', pricePerUnit: 800, totalPrice: 2400, lowStockThreshold: 1, brand: 'Usha', userId: branch1?.id },
      { productName: 'Circuit Breaker', quantity: 5, unit: 'pcs', pricePerUnit: 150, totalPrice: 750, lowStockThreshold: 2, brand: 'Siemens', userId: admin2?.id },
      { productName: 'Cable Ties', quantity: 100, unit: 'pcs', pricePerUnit: 0.5, totalPrice: 50, lowStockThreshold: 20, brand: 'Generic', userId: branch2?.id },
      { productName: 'LED Bulb', quantity: 20, unit: 'pcs', pricePerUnit: 5, totalPrice: 100, lowStockThreshold: 5, brand: 'Philips', userId: admin1?.id },
      { productName: 'Extension Cord', quantity: 8, unit: 'pcs', pricePerUnit: 25, totalPrice: 200, lowStockThreshold: 3, brand: 'Havells', userId: branch3?.id },
      { productName: 'Multimeter', quantity: 4, unit: 'pcs', pricePerUnit: 300, totalPrice: 1200, lowStockThreshold: 1, brand: 'Fluke', userId: admin2?.id },
      { productName: 'Conduit Pipe', quantity: 15, unit: 'meters', pricePerUnit: 10, totalPrice: 150, lowStockThreshold: 5, brand: 'Finolex', userId: branch1?.id },
      { productName: 'Wall Socket', quantity: 12, unit: 'pcs', pricePerUnit: 15, totalPrice: 180, lowStockThreshold: 4, brand: 'Anchor', userId: admin1?.id },
      { productName: 'MCB Box', quantity: 6, unit: 'pcs', pricePerUnit: 200, totalPrice: 1200, lowStockThreshold: 2, brand: 'Legrand', userId: branch2?.id },
      { productName: 'Soldering Iron', quantity: 3, unit: 'pcs', pricePerUnit: 150, totalPrice: 450, lowStockThreshold: 1, brand: 'Weller', userId: admin2?.id },
      { productName: 'PVC Pipe', quantity: 10, unit: 'meters', pricePerUnit: 8, totalPrice: 80, lowStockThreshold: 3, brand: 'Supreme', userId: branch3?.id },
      { productName: 'Ceiling Fan', quantity: 7, unit: 'pcs', pricePerUnit: 1200, totalPrice: 8400, lowStockThreshold: 2, brand: 'Bajaj', userId: admin1?.id },
      { productName: 'Power Strip', quantity: 9, unit: 'pcs', pricePerUnit: 30, totalPrice: 270, lowStockThreshold: 3, brand: 'Belkin', userId: branch1?.id },
      { productName: 'Junction Box', quantity: 11, unit: 'pcs', pricePerUnit: 12, totalPrice: 132, lowStockThreshold: 4, brand: 'Generic', userId: admin2?.id },
      { productName: 'Insulation Tape', quantity: 25, unit: 'rolls', pricePerUnit: 2, totalPrice: 50, lowStockThreshold: 5, brand: '3M', userId: branch2?.id },
      { productName: 'Drill Machine', quantity: 2, unit: 'pcs', pricePerUnit: 800, totalPrice: 1600, lowStockThreshold: 1, brand: 'Bosch', userId: admin1?.id },
      { productName: 'Cable Clips', quantity: 50, unit: 'pcs', pricePerUnit: 0.3, totalPrice: 15, lowStockThreshold: 10, brand: 'Generic', userId: branch3?.id },
      { productName: 'Voltage Stabilizer', quantity: 4, unit: 'pcs', pricePerUnit: 500, totalPrice: 2000, lowStockThreshold: 1, brand: 'V-Guard', userId: admin2?.id },
    ];

    for (const p of samplePurchases) {
      const exists = await this.purchaseService.findDuplicate(p.productName, p.userId!);
      if (!exists) {
        await this.purchaseService.create(p, p.userId!);
        Logger.log(`✔ Purchase created: ${p.productName}`);
      }
    }

    // GENERATE ALERTS based on purchases
    const allBranches = await this.branchService.findAll();
    for (const branch of allBranches) {
      await this.alertService.generateAlertsForBranch(branch.id);
      Logger.log(`✔ Alerts generated for branch: ${branch.name}`);
    }

    Logger.log('🌱 Database Seeding Completed.');
  }
}
