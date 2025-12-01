import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { AlertPriority } from '../../shared/enums/alert-priority.enum';
import { AlertType } from '../../shared/enums/alert-type.enum';
import { AlertStatus } from '../../shared/enums/alert-status.enum';

export class CreateAlertDto {
  @IsString()
  itemName: string;

  @IsNumber()
  currentStock: number;

  @IsNumber()
  minStock: number;

  @IsNumber()
  shortage: number;

  @IsEnum(AlertPriority)
  @IsOptional()
  priority?: AlertPriority;

  @IsEnum(AlertType)
  alertType: AlertType;

  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  branchId: number;
}
