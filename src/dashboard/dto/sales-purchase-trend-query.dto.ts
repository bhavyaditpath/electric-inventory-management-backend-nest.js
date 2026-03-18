import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PurchaseTrendPeriod } from './purchase-trend-query.dto';

export class SalesPurchaseTrendQueryDto {
  @IsOptional()
  @IsEnum(PurchaseTrendPeriod)
  period?: PurchaseTrendPeriod = PurchaseTrendPeriod.MONTH;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;
}
