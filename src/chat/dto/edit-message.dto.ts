import { IsEnum, IsJSON, IsNotEmpty, IsOptional, IsString, MaxLength, Validate, ValidateIf } from 'class-validator';
import { ChatLanguage, ChatMessageKind } from '../enums/chat-message-format.enum';
import { MessageLanguageByKindValidator } from '../validators/message-language-by-kind.validator';

export class EditMessageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @ValidateIf((o: EditMessageDto) => o.kind === ChatMessageKind.JSON && o.content !== undefined)
  @IsJSON({ message: 'content must be valid JSON when kind is json' })
  content?: string;

  @IsOptional()
  @IsEnum(ChatMessageKind)
  kind?: ChatMessageKind;

  @IsOptional()
  @IsEnum(ChatLanguage)
  @Validate(MessageLanguageByKindValidator)
  language?: ChatLanguage;
}
