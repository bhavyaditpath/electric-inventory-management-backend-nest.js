import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class AddParticipantsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  participantIds: number[];
}
