import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BranchModule } from './branch/branch.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PurchaseModule } from './purchase/purchase.module';
import { InventoryModule } from './inventory/inventory.module';
import { User } from './user/entities/user.entity';
import { Branch } from './branch/entities/branch.entity';
import { SeederService } from './seeder/seeder.service';
import { SeederModule } from './seeder/seeder.module';
import { AlertModule } from './alert/alert.module';
import { RequestModule } from './request/request.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationModule } from './notification/notification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ChatModule } from './chat/chat.module';
import { CallGateway } from './chat/Gateways/call/call.gateway';
import { CallController } from './call/call.controller';
import { CallLogsController } from './call-logs/call-logs.controller';
import dbConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dbConfig),
    ScheduleModule.forRoot(),
    BranchModule,
    UserModule,
    AuthModule,
    PurchaseModule,
    InventoryModule,
    SeederModule,
    AlertModule,
    RequestModule,
    ReportsModule,
    NotificationModule,
    DashboardModule,
    ChatModule,
  ],
  controllers: [CallController, CallLogsController],
  providers: [SeederService, CallGateway],
})
export class AppModule {}
