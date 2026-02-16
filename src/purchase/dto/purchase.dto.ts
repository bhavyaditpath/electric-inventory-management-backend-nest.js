import { IsString, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePurchaseDto {
  @IsString()
  productName: string;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  quantity: number;

  @IsString()
  unit: string;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  pricePerUnit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  totalPrice?: number;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  lowStockThreshold: number;

  @IsString()
  brand: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  branchId?: number;

  @IsOptional()
  @IsNumber()
  adminUserId?: number;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  pricePerUnit?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  branchId?: number;

  @IsOptional()
  @IsNumber()
  adminUserId?: number;
}

export class PurchaseResponseDto {
  id: number;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  lowStockThreshold: number;
  brand: string;
  userId: number;
  branchId?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  updatedBy?: number;
  isRemoved: boolean;
}
