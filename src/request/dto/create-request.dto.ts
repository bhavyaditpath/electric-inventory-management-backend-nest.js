import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRequestDto {
  @IsNotEmpty()
  @IsNumber()
  adminUserId: number;

  @IsNotEmpty()
  @IsNumber()
  purchaseId: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantityRequested: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
