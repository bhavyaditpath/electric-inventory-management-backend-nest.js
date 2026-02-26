import { NestFactory } from '@nestjs/core';
import { ReportsWorkerModule } from './reports.worker.module';
import { ReportsService } from './reports/reports.service';
import { ReportType } from './shared/enums/report-type.enum';

function parseReportType(input: string): ReportType {
  const normalized = input.trim().toLowerCase();
  const supported = Object.values(ReportType) as string[];

  if (!supported.includes(normalized)) {
    throw new Error(
      `Invalid REPORT_TRIGGER_TYPE="${input}". Use one of: ${supported.join(', ')}`,
    );
  }

  return normalized as ReportType;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ReportsWorkerModule);

  try {
    const reportsService = app.get(ReportsService);
    const reportType = parseReportType(process.env.REPORT_TRIGGER_TYPE || ReportType.DAILY);

    console.log(`Triggering ${reportType} report job now...`);
    await reportsService.runReportNow(reportType);
    console.log(`Completed ${reportType} report job.`);
  } finally {
    await app.close();
  }
}

bootstrap();
// npm run trigger:reports

// $env:REPORT_TRIGGER_TYPE='weekly'; npm run trigger:reports
// $env:REPORT_TRIGGER_TYPE='monthly'; npm run trigger:reports
// $env:REPORT_TRIGGER_TYPE='half_yearly'; npm run trigger:reports
// $env:REPORT_TRIGGER_TYPE='yearly'; npm run trigger:reports

