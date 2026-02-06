import { IsBoolean } from 'class-validator';

export class PinChatRoomDto {
  @IsBoolean()
  pinned: boolean;
}
