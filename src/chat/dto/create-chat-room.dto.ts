import { IsString, IsBoolean, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateChatRoomDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isGroupChat?: boolean;

  @IsArray()
  @IsOptional()
  participantIds?: number[];
}
