import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportType } from 'src/shared/enums/report-type.enum';
import { ReportsService } from '../reports.service';

@Injectable()
export class ReportCronService {
  private readonly reportsCronEnabled = process.env.REPORTS_CRON_ENABLED === 'true';

  constructor(private readonly reportsService: ReportsService) {}

  @Cron('59 59 23 * * *')
  async handleDailyReports() {
    if (!this.reportsCronEnabled) {
      return;
    }
    console.log('Generating daily reports...');
    await this.reportsService.runReportNow(ReportType.DAILY);
  }

  @Cron('59 59 23 * * 0')
  async handleWeeklyReports() {
    if (!this.reportsCronEnabled) {
      return;
    }
    console.log('Generating weekly reports...');
    await this.reportsService.runReportNow(ReportType.WEEKLY);
  }

  @Cron('59 59 23 * * *')
  async handleMonthlyReports() {
    if (!this.reportsCronEnabled) {
      return;
    }
    const now = new Date();
    if (!this.isMonthEnd(now)) {
      return;
    }

    console.log('Generating monthly reports (month-end)...');
    await this.reportsService.runReportNow(ReportType.MONTHLY);
  }

  @Cron('59 59 23 * * *')
  async handleHalfYearlyReports() {
    if (!this.reportsCronEnabled) {
      return;
    }
    const now = new Date();
    if (!this.isHalfYearEnd(now)) {
      return;
    }

    console.log('Generating half-yearly reports (period-end)...');
    await this.reportsService.runReportNow(ReportType.HALF_YEARLY);
  }

  @Cron('59 59 23 * * *')
  async handleYearlyReports() {
    if (!this.reportsCronEnabled) {
      return;
    }
    const now = new Date();
    if (!this.isYearEnd(now)) {
      return;
    }

    console.log('Generating yearly reports (year-end)...');
    await this.reportsService.runReportNow(ReportType.YEARLY);
  }

  private isMonthEnd(date: Date): boolean {
    const tomorrow = new Date(date);
    tomorrow.setDate(date.getDate() + 1);
    return tomorrow.getDate() === 1;
  }

  private isHalfYearEnd(date: Date): boolean {
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();
    return (month === 5 && day === 30) || (month === 11 && day === 31);
  }

  private isYearEnd(date: Date): boolean {
    return date.getMonth() === 11 && date.getDate() === 31;
  }
}
