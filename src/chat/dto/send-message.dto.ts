import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatRoomId: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}
