import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Purchase } from '../purchase/entities/purchase.entity';
import { User } from '../user/entities/user.entity';
import { ReportPreference } from './entities/report-preference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase, User, ReportPreference])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}