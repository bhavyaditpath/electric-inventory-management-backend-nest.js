import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, User]), NotificationModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}
