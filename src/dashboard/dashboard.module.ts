import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Purchase } from '../purchase/entities/purchase.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Request } from '../request/entities/request.entity';
import { StockAlert } from '../alert/entities/alert.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Branch, Request, StockAlert, User]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}