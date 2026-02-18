import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ToggleMessageReactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  emoji: string;
}
