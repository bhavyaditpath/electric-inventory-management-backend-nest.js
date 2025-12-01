import { IsString, IsOptional } from 'class-validator';

export class ResolveAlertDto {
  @IsString()
  @IsOptional()
  notes?: string;
}