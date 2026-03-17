import { IsString, IsNumber, IsOptional, IsNotEmpty, IsEnum, IsJSON, Validate, ValidateIf, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatLanguage, ChatMessageKind } from '../enums/chat-message-format.enum';
import { MessageLanguageByKindValidator } from '../validators/message-language-by-kind.validator';

export class SendMessageDto {
  @IsNumber()
  @Type(() => Number)
  chatRoomId: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o: SendMessageDto) => o.kind === ChatMessageKind.JSON && o.content !== undefined)
  @IsJSON({ message: 'content must be valid JSON when kind is json' })
  content?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  replyToMessageId?: number;

  @IsOptional()
  @IsEnum(ChatMessageKind)
  kind?: ChatMessageKind;

  @IsOptional()
  @IsEnum(ChatLanguage)
  @Validate(MessageLanguageByKindValidator)
  language?: ChatLanguage;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  viewOnce?: boolean;
}
