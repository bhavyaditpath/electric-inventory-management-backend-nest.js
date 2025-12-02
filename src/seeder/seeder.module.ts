import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { BranchModule } from '../branch/branch.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { AlertModule } from '../alert/alert.module';

@Module({
  imports: [UserModule, BranchModule, PurchaseModule, AlertModule],
})
export class SeederModule {}
