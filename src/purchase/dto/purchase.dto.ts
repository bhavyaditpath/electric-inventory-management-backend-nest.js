import { IsString, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  productName: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  unit: string;

  @IsNumber()
  @IsPositive()
  pricePerUnit: number;

  @IsNumber()
  @IsPositive()
  totalPrice: number;

  @IsNumber()
  @Min(0)
  lowStockThreshold: number;

  @IsString()
  brand: string;

  @IsOptional()
  @IsNumber()
  branchId?: number;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerUnit?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  branchId?: number;
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
