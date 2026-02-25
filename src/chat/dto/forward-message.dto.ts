import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ForwardMessageDto {
  @IsInt()
  @Type(() => Number)
  sourceMessageId: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Type(() => Number)
  targetRoomIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
