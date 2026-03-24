import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StockHealthQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;
}
