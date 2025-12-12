import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { Request } from './entities/request.entity';
import { User } from '../user/entities/user.entity';
import { Purchase } from '../purchase/entities/purchase.entity';
import { AlertModule } from 'src/alert/alert.module';

@Module({
  imports: [TypeOrmModule.forFeature([Request, User, Purchase]), AlertModule],
  controllers: [RequestController],
  providers: [RequestService],
})
export class RequestModule {}
