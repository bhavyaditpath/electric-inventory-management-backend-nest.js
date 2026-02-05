import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsNumber()
  @Type(() => Number)
  chatRoomId: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}
