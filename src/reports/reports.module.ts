import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Purchase } from '../purchase/entities/purchase.entity';
import { User } from '../user/entities/user.entity';
import { ReportPreference } from './entities/report-preference.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { Branch } from 'src/branch/entities/branch.entity';
import { ReportCronService } from './report-cron/report-cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase, User, ReportPreference, Branch
  ]), AuthModule, NotificationModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportCronService],
})
export class ReportsModule {}