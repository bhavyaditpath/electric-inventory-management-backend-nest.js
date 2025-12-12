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
import { renderTemplate } from 'src/utils/template-loader';
import { ApiResponseUtil } from '../shared/api-response';

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
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0); // Set to midnight today

    return this.generateReport(startOfDay, now, userId);
  }

  async getWeeklyReport(userId?: number) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    return this.generateReport(startOfWeek, now, userId);
  }

  async getMonthlyReport(userId?: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.generateReport(startOfMonth, now, userId);
  }

  async getHalfYearlyReport(userId?: number) {
    const now = new Date();
    let startOfHalfYear = new Date(now);

    // Calculate start of current half-year period
    const currentMonth = now.getMonth();
    if (currentMonth >= 6) {
      // Second half: July 1st
      startOfHalfYear = new Date(now.getFullYear(), 6, 1);
    } else {
      // First half: January 1st
      startOfHalfYear = new Date(now.getFullYear(), 0, 1);
    }
    startOfHalfYear.setHours(0, 0, 0, 0);

    return this.generateReport(startOfHalfYear, now, userId);
  }

  async getYearlyReport(userId?: number) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    return this.generateReport(startOfYear, now, userId);
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

  async createPreference(userId: number, createDto: CreateReportPreferenceDto): Promise<any> {
    // Check for unique constraint - user can't have multiple preferences for same report type
    const existingPreference = await this.reportPreferenceRepository.findOne({
      where: {
        userId,
        reportType: createDto.reportType,
        isRemoved: false
      }
    });

    if (existingPreference) {
      return ApiResponseUtil.error(`Report preference for ${createDto.reportType} already exists for this user`);
    }

    const preference = this.reportPreferenceRepository.create({
      ...createDto,
      userId,
    });
    const savedPreference = await this.reportPreferenceRepository.save(preference);
    return ApiResponseUtil.success(savedPreference, 'Report preference created successfully');
  }

  async findUserPreferences(userId: number): Promise<ReportPreference[]> {
    return this.reportPreferenceRepository.find({
      where: { userId, isRemoved: false },
    });
  }

  async updatePreference(id: number, updateDto: UpdateReportPreferenceDto): Promise<any> {
    // First get the existing preference to check for unique constraint
    const existingPreference = await this.reportPreferenceRepository.findOne({ where: { id } });
    if (!existingPreference) {
      return ApiResponseUtil.error('Report preference not found');
    }

    // Check if user is trying to change report type and if it would create a duplicate
    if (updateDto.reportType && updateDto.reportType !== existingPreference.reportType) {
      const duplicateCheck = await this.reportPreferenceRepository.findOne({
        where: {
          userId: existingPreference.userId,
          reportType: updateDto.reportType,
          isRemoved: false
        }
      });

      if (duplicateCheck) {
        return ApiResponseUtil.error(`Report preference for ${updateDto.reportType} already exists for this user`);
      }
    }

    await this.reportPreferenceRepository.update(id, updateDto);
    const updatedPreference = await this.reportPreferenceRepository.findOne({ where: { id } });
    return ApiResponseUtil.success(updatedPreference, 'Report preference updated successfully');
  }

  async removePreference(id: number): Promise<any> {
    const preference = await this.reportPreferenceRepository.findOne({ where: { id } });
    if (!preference) {
      return ApiResponseUtil.error('Report preference not found');
    }

    await this.reportPreferenceRepository.update(id, { isRemoved: true });
    return ApiResponseUtil.success(null, 'Report preference removed successfully');
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

    const html = renderTemplate("report-email", {
      reportTypeDisplay,
      reportTypeDisplayLower: reportTypeDisplay.toLowerCase(),
      generatedDate,
      userDisplay,
    });

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
