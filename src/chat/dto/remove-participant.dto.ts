import { IsNumber, IsOptional } from 'class-validator';

export class RemoveParticipantDto {
  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsNumber()
  newAdminId?: number;
}
