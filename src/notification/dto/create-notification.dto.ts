import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { NotificationType } from '../../shared/enums/notification-type.enum';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;
}