import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum PurchaseTrendPeriod {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class PurchaseTrendQueryDto {
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
