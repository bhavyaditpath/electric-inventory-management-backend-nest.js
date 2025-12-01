import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import dbConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dbConfig),
    BranchModule,
    UserModule,
    AuthModule,
    PurchaseModule,
    InventoryModule,
    SeederModule,
    AlertModule,
  ],
  controllers: [],
  providers: [SeederService],
})
export class AppModule {}
