import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { BranchModule } from '../branch/branch.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Branch]), BranchModule, NotificationModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
