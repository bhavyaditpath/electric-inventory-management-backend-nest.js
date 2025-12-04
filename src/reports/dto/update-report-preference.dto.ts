import { PartialType } from '@nestjs/mapped-types';
import { CreateReportPreferenceDto } from './create-report-preference.dto';

export class UpdateReportPreferenceDto extends PartialType(CreateReportPreferenceDto) {}