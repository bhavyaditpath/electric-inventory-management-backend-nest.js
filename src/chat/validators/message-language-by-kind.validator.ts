import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ChatLanguage, ChatMessageKind } from '../enums/chat-message-format.enum';

@ValidatorConstraint({ name: 'MessageLanguageByKind', async: false })
export class MessageLanguageByKindValidator implements ValidatorConstraintInterface {
  validate(language: unknown, args: ValidationArguments): boolean {
    if (language === undefined || language === null) {
      return true;
    }

    const dto = args.object as { kind?: ChatMessageKind };
    const kind = dto.kind ?? ChatMessageKind.TEXT;
    if (!Object.values(ChatLanguage).includes(language as ChatLanguage)) {
      return false;
    }

    if (kind === ChatMessageKind.CODE) {
      return true;
    }
    if (kind === ChatMessageKind.HTML) {
      return language === ChatLanguage.HTML;
    }
    if (kind === ChatMessageKind.JSON) {
      return language === ChatLanguage.JSON;
    }

    return language === ChatLanguage.PLAINTEXT;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as { kind?: ChatMessageKind };
    const kind = dto.kind ?? ChatMessageKind.TEXT;
    if (kind === ChatMessageKind.CODE) {
      return 'language must be a valid code language';
    }
    if (kind === ChatMessageKind.HTML) {
      return 'language must be html when kind is html';
    }
    if (kind === ChatMessageKind.JSON) {
      return 'language must be json when kind is json';
    }
    return 'language must be plaintext for non-code kinds';
  }
}
