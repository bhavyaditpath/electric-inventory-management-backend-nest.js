import { IsString, IsOptional } from 'class-validator';

export class DismissAlertDto {
  @IsString()
  @IsOptional()
  notes?: string;
}