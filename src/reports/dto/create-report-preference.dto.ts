import { IsEnum, IsOptional } from 'class-validator';
import { DeliveryMethod } from 'src/shared/enums/delivery-method.enum';
import { ReportType } from 'src/shared/enums/report-type.enum';

export class CreateReportPreferenceDto {
  @IsEnum(ReportType)
  reportType: ReportType;

  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @IsOptional()
  isActive?: boolean;
}