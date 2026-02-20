import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateChatRoomNameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
