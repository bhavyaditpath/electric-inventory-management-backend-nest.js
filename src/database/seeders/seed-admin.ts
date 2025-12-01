import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UserService } from '../../user/user.service';
import { BranchService } from '../../branch/branch.service';
import { HashUtil } from '../../utils/hash.util';
import { UserRole } from '../../shared/enums/role.enum';

async function seedData() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const branchService = app.get(BranchService);

  // Seed branches first
  const branches = [
    { name: 'Main Branch', address: '123 Main St', phone: '555-0100' },
    { name: 'Downtown Branch', address: '456 Downtown Ave', phone: '555-0200' },
  ];

  for (const branchData of branches) {
    const existing = await branchService.findByName(branchData.name);
    if (!existing) {
      await branchService.create(branchData);
      console.log(`Branch "${branchData.name}" created!`);
    }
  }

  // Seed admin user
  const adminUsername = 'admin';
  const adminPassword = 'admin';
  const adminBranchName = 'Main Branch';

  const existingAdmin = await userService.findByUsername(adminUsername);
  const hashedPassword = await HashUtil.hash(adminPassword);
  const branch = await branchService.findByName(adminBranchName);

  if (!existingAdmin) {
    if (branch) {
      const user = await userService.create({
        username: adminUsername,
        password: adminPassword,
        role: UserRole.ADMIN,
        branchName: adminBranchName,
      });
      console.log(user)

      console.log(`Admin user created!`);
      console.log(`Username: ${adminUsername}`);
      console.log(`Password: ${adminPassword}`);
      console.log(`Branch: ${adminBranchName}`);
    } else {
      console.log('Branch not found for admin user');
    }
  } else {
    // Update password if different
    if (existingAdmin.password !== hashedPassword) {
      await userService.update(existingAdmin.id, {
        username: adminUsername,
        password: adminPassword,
        role: UserRole.ADMIN,
        branchName: adminBranchName,
      });
      console.log('Admin password updated');
    }
    console.log('Admin user already exists');
  }

  // Seed branch users
  const branchUsers = [
    {
      username: 'branch2',
      password: 'branch2',
      branchName: 'Downtown Branch',
      role: UserRole.BRANCH
    }
  ];

  for (const userData of branchUsers) {
    const existingUser = await userService.findByUsername(userData.username);
    const branch = await branchService.findByName(userData.branchName);

    if (!existingUser) {
      if (branch) {
        const user = await userService.create({
          username: userData.username,
          password: userData.password,
          role: userData.role,
          branchName: userData.branchName,
        });
        console.log(`Branch user created!`);
        console.log(`Username: ${userData.username}`);
        console.log(`Password: ${userData.password}`);
        console.log(`Branch: ${userData.branchName}`);
        console.log(`Role: ${userData.role}`);
      } else {
        console.log(`Branch "${userData.branchName}" not found for user ${userData.username}`);
      }
    } else {
      console.log(`Branch user "${userData.username}" already exists`);
    }
  }

  await app.close();
}

seedData();
