import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateRequestDto } from './create-request.dto';
import { RequestStatus } from '../../shared/enums/request-status.enum';

export class UpdateRequestDto extends PartialType(CreateRequestDto) {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
