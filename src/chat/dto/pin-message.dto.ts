import { IsBoolean, IsNotEmpty } from 'class-validator';

export class PinMessageDto {
  @IsBoolean()
  @IsNotEmpty()
  pinned: boolean;
}
