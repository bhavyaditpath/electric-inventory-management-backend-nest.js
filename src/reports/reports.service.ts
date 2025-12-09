import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { Purchase } from '../purchase/entities/purchase.entity';
import { ReportPreference } from './entities/report-preference.entity';
import { CreateReportPreferenceDto } from './dto/create-report-preference.dto';
import { UpdateReportPreferenceDto } from './dto/update-report-preference.dto';
import { ReportType } from 'src/shared/enums/report-type.enum';
import { DeliveryMethod } from 'src/shared/enums/delivery-method.enum';
import { EmailService } from '../auth/email.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(ReportPreference)
    private reportPreferenceRepository: Repository<ReportPreference>,
    private emailService: EmailService,
  ) { }

  async getDailyReport(userId?: number) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return this.generateReport(dayAgo, now, userId);
  }

  async getWeeklyReport(userId?: number) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return this.generateReport(weekAgo, now, userId);
  }

  async getMonthlyReport(userId?: number) {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    return this.generateReport(monthAgo, now, userId);
  }

  async getHalfYearlyReport(userId?: number) {
    const now = new Date();
    const halfYearAgo = new Date(now);
    halfYearAgo.setMonth(now.getMonth() - 6);

    return this.generateReport(halfYearAgo, now, userId);
  }

  async getYearlyReport(userId?: number) {
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    return this.generateReport(yearAgo, now, userId);
  }

  private async generateReport(startDate: Date, endDate: Date, userId?: number) {
    let query = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.user', 'user')
      .select([
        'COUNT(purchase.id) AS "totalPurchases"',
        'SUM(purchase.quantity) AS "totalQuantity"',
        'SUM(purchase.totalPrice) AS "totalPrice"',
        'AVG(purchase.totalPrice) AS "averagePrice"',
      ])
      .where('purchase.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('purchase.isRemoved = :isRemoved', { isRemoved: false });

    if (userId) {
      query = query.andWhere('purchase.userId = :userId', { userId });
    }

    const result = await query.getRawOne();

    // Handle case where no purchases exist for the period
    if (!result) {
      return {
        period: {
          startDate,
          endDate,
        },
        summary: {
          totalPurchases: 0,
          totalQuantity: 0,
          totalPrice: 0,
          averagePrice: 0,
        },
      };
    }

    return {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalPurchases: parseInt(result.totalPurchases),
        totalQuantity: parseFloat(result.totalQuantity),
        totalPrice: parseFloat(result.totalPrice),
        averagePrice: parseFloat(result.averagePrice),
      },
    };
  }

  async createPreference(userId: number, createDto: CreateReportPreferenceDto): Promise<ReportPreference> {
    const preference = this.reportPreferenceRepository.create({
      ...createDto,
      userId,
    });
    return this.reportPreferenceRepository.save(preference);
  }

  async findUserPreferences(userId: number): Promise<ReportPreference[]> {
    return this.reportPreferenceRepository.find({
      where: { userId, isRemoved: false },
    });
  }

  async updatePreference(id: number, updateDto: UpdateReportPreferenceDto): Promise<ReportPreference> {
    await this.reportPreferenceRepository.update(id, updateDto);
    const preference = await this.reportPreferenceRepository.findOne({ where: { id } });
    if (!preference) {
      throw new Error('Report preference not found');
    }
    return preference;
  }

  async removePreference(id: number): Promise<void> {
    await this.reportPreferenceRepository.update(id, { isRemoved: true });
  }

  async getActivePreferences(userId: number): Promise<ReportPreference[]> {
    return this.reportPreferenceRepository.find({
      where: { userId, isActive: true, isRemoved: false },
    });
  }

  private getReportBasePath(): string {
    return 'D:\\Reports';
  }

  private getReportFolder(reportType: ReportType): string {
    const basePath = this.getReportBasePath();
    const folderName = reportType.toLowerCase();
    return path.join(basePath, folderName);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private generateReportFileName(reportType: ReportType, userId?: number): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const userSuffix = userId ? `_user_${userId}` : '_all_users';
    return `${reportType}_${dateStr}_${timeStr}${userSuffix}.xlsx`;
  }

  private async generateReportData(reportType: ReportType, userId?: number) {
    switch (reportType) {
      case ReportType.DAILY:
        return await this.getDailyReport(userId);
      case ReportType.WEEKLY:
        return await this.getWeeklyReport(userId);
      case ReportType.MONTHLY:
        return await this.getMonthlyReport(userId);
      case ReportType.HALF_YEARLY:
        return await this.getHalfYearlyReport(userId);
      case ReportType.YEARLY:
        return await this.getYearlyReport(userId);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private createReportWorkbook(reportType: ReportType, reportData: any, userId?: number): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`);

    // Add report metadata
    worksheet.addRow(['Report Type', reportType.toUpperCase()]);
    worksheet.addRow(['Generated At', new Date().toLocaleString('en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    })]);
    worksheet.addRow(['User ID', userId || 'All Users']);
    worksheet.addRow(['Period Start', reportData.period.startDate.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    })]);
    worksheet.addRow(['Period End', reportData.period.endDate.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    })]);
    worksheet.addRow([]); // Empty row

    // Add summary section
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Purchases', reportData.summary.totalPurchases]);
    worksheet.addRow(['Total Quantity', reportData.summary.totalQuantity]);
    worksheet.addRow(['Total Price', reportData.summary.totalPrice]);
    worksheet.addRow(['Average Price', reportData.summary.averagePrice]);
    worksheet.addRow([]); // Empty row

    // Style the headers
    worksheet.getCell('A1').font = { bold: true };
    worksheet.getCell('A7').font = { bold: true };
    worksheet.getCell('A8').font = { bold: true };
    worksheet.getCell('A9').font = { bold: true };
    worksheet.getCell('A10').font = { bold: true };
    worksheet.getCell('A11').font = { bold: true };

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });

    return workbook;
  }

  async generateAndSaveReport(reportType: ReportType, userId?: number): Promise<string> {
    const reportData = await this.generateReportData(reportType, userId);

    const folderPath = this.getReportFolder(reportType);
    this.ensureDirectoryExists(folderPath);

    const fileName = this.generateReportFileName(reportType, userId);
    const filePath = path.join(folderPath, fileName);

    const workbook = this.createReportWorkbook(reportType, reportData, userId);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  private async generateReportBuffer(reportType: ReportType, userId?: number): Promise<Buffer> {
    const reportData = await this.generateReportData(reportType, userId);
    const workbook = this.createReportWorkbook(reportType, reportData, userId);
    return await workbook.xlsx.writeBuffer() as any;
  }

  private async sendReportEmail(to: string, reportType: ReportType, buffer: Buffer, userId?: number): Promise<void> {
    const fileName = this.generateReportFileName(reportType, userId);
    const subject = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
    const generatedDate = new Date().toLocaleString();
    const reportTypeDisplay = reportType.charAt(0).toUpperCase() + reportType.slice(1).toLowerCase();
    const userDisplay = userId ? `User ID: ${userId}` : 'All Users';

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportTypeDisplay} Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #007bff;
            color: #ffffff;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
          }
          .report-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
          }
          .report-info p {
            margin: 5px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            margin-top: 20px;
          }
          .attachment-note {
            font-weight: bold;
            color: #28a745;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${reportTypeDisplay} Report</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your scheduled <strong>${reportTypeDisplay.toLowerCase()}</strong> report has been generated and is attached to this email.</p>

            <div class="report-info">
              <p><strong>Report Details:</strong></p>
              <p>Report Type: ${reportTypeDisplay}</p>
              <p>Generated On: ${generatedDate}</p>
              <p>${userDisplay}</p>
            </div>

            <p class="attachment-note">📎 Please find the report attached as an Excel file.</p>

            <p>If you have any questions or need further assistance, please don't hesitate to contact us.</p>

            <p>Best regards,<br>
            Electric Inventory System</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendReportEmail(to, subject, html, {
      filename: fileName,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  async processScheduledReports(): Promise<void> {
    const activePreferences = await this.reportPreferenceRepository.find({
      where: { isActive: true, isRemoved: false },
      relations: ['user'],
    });

    for (const preference of activePreferences) {
      try {
        if (preference.deliveryMethod === DeliveryMethod.LOCAL_FILE) {
          await this.generateAndSaveReport(preference.reportType, preference.userId);
        } else if (preference.deliveryMethod === DeliveryMethod.EMAIL) {
          const reportBuffer = await this.generateReportBuffer(preference.reportType, preference.userId);
          await this.sendReportEmail(preference.user.email || preference.user.username, preference.reportType, reportBuffer, preference.userId);
        }
      } catch (error) {
        console.error(`Failed to generate report for user ${preference.userId}:`, error);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyReports() {
    console.log('Generating daily reports...');
    await this.processReportsByType(ReportType.DAILY);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyReports() {
    console.log('Generating weekly reports...');
    await this.processReportsByType(ReportType.WEEKLY);
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyReports() {
    console.log('Generating monthly reports...');
    await this.processReportsByType(ReportType.MONTHLY);
  }

  @Cron('0 0 1 */6 *') // Every 6 months on the 1st day at midnight
  async handleHalfYearlyReports() {
    console.log('Generating half-yearly reports...');
    await this.processReportsByType(ReportType.HALF_YEARLY);
  }

  @Cron(CronExpression.EVERY_YEAR)
  async handleYearlyReports() {
    console.log('Generating yearly reports...');
    await this.processReportsByType(ReportType.YEARLY);
  }

  private async processReportsByType(reportType: ReportType): Promise<void> {
    const preferences = await this.reportPreferenceRepository.find({
      where: {
        reportType,
        isActive: true,
        isRemoved: false,
      },
      relations: ['user'],
    });

    for (const preference of preferences) {
      try {
        if (preference.deliveryMethod === DeliveryMethod.LOCAL_FILE) {
          await this.generateAndSaveReport(reportType, preference.userId);
          console.log(`Generated ${reportType} report for user ${preference.userId}`);
        } else if (preference.deliveryMethod === DeliveryMethod.EMAIL) {
          const reportBuffer = await this.generateReportBuffer(reportType, preference.userId);
          await this.sendReportEmail(preference.user.email, reportType, reportBuffer, preference.userId);
          console.log(`Sent ${reportType} report via email to user ${preference.userId}`);
        }
      } catch (error) {
        console.error(`Failed to generate ${reportType} report for user ${preference.userId}:`, error);
      }
    }
  }
}
