import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { Purchase } from '../purchase/entities/purchase.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from 'src/branch/entities/branch.entity';
import { ReportPreference } from './entities/report-preference.entity';
import { CreateReportPreferenceDto } from './dto/create-report-preference.dto';
import { UpdateReportPreferenceDto } from './dto/update-report-preference.dto';
import { ReportType } from 'src/shared/enums/report-type.enum';
import { DeliveryMethod } from 'src/shared/enums/delivery-method.enum';
import { EmailService } from '../auth/email.service';
import { renderTemplate } from 'src/utils/template-loader';
import { ApiResponseUtil } from '../shared/api-response';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../shared/enums/notification-type.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(ReportPreference)
    private reportPreferenceRepository: Repository<ReportPreference>,
    private emailService: EmailService,
    private notificationService: NotificationService,
  ) { }

  async getDailyReport(user?: User) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0); // Set to midnight today

    return this.generateReport(startOfDay, now, user);
  }

  async getWeeklyReport(user?: User) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    return this.generateReport(startOfWeek, now, user);
  }

  async getMonthlyReport(user?: User) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.generateReport(startOfMonth, now, user);
  }

  async getHalfYearlyReport(user?: User) {
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

    return this.generateReport(startOfHalfYear, now, user);
  }

  async getYearlyReport(user?: User) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    return this.generateReport(startOfYear, now, user);
  }

  private async generateReport(startDate: Date, endDate: Date, user?: User) {
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

    if (user) {
      query = query.andWhere('purchase.branchId = :branchId', { branchId: user.branchId });
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
        deliveryMethod: createDto.deliveryMethod,
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

  private generateReportFileName(reportType: ReportType, user?: User): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const branchSuffix = user ? `_branch_${user.branch.name}` : '_all_branches';
    return `${reportType}_${dateStr}_${timeStr}${branchSuffix}.xlsx`;
  }

  private async generateReportData(reportType: ReportType, user?: User) {
    switch (reportType) {
      case ReportType.DAILY:
        return await this.getDailyReport(user);
      case ReportType.WEEKLY:
        return await this.getWeeklyReport(user);
      case ReportType.MONTHLY:
        return await this.getMonthlyReport(user);
      case ReportType.HALF_YEARLY:
        return await this.getHalfYearlyReport(user);
      case ReportType.YEARLY:
        return await this.getYearlyReport(user);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private async resolveBranchName(user?: User): Promise<string> {
    if (!user) {
      return 'All Branches';
    }

    if (user.branch?.name) {
      return user.branch.name;
    }

    if (!user.branchId) {
      return 'All Branches';
    }

    const branch = await this.branchRepository.findOne({
      where: { id: user.branchId },
      select: ['name'],
    });

    return branch?.name ?? `Branch ${user.branchId}`;
  }


  private async createReportWorkbook(reportType: ReportType, reportData: any, user?: User): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Inventory Reporting Service';
    workbook.lastModifiedBy = 'Inventory Reporting Service';
    workbook.created = new Date();
    workbook.modified = new Date();

    const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
    const worksheet = workbook.addWorksheet(reportTitle, {
      properties: { defaultRowHeight: 20 },
      views: [{ showGridLines: true }],
    });

    const createdAt = new Date();
    const startDate = new Date(reportData.period.startDate);
    const endDate = new Date(reportData.period.endDate);
    const branchName = await this.resolveBranchName(user);

    const sectionHeaderFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF3F4F6' },
    };
    const titleFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FF1F2937' },
    };
    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    };

    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 30 },
    ];

    worksheet.mergeCells('A1:B1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = titleFill;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    const metadataHeaderRow = worksheet.addRow(['Report Metadata', '']);
    worksheet.mergeCells(`A${metadataHeaderRow.number}:B${metadataHeaderRow.number}`);
    metadataHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF111827' } };
    metadataHeaderRow.getCell(1).fill = sectionHeaderFill;
    metadataHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const metadataRows: Array<{ label: string; value: string | number | Date }> = [
      { label: 'Report Type', value: reportType.toUpperCase() },
      { label: 'Generated At', value: createdAt },
      { label: 'Branch Name', value: branchName },
      { label: 'Period Start', value: startDate },
      { label: 'Period End', value: endDate },
    ];

    metadataRows.forEach((item) => {
      const row = worksheet.addRow([item.label, item.value]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF374151' } };
      row.getCell(1).fill = sectionHeaderFill;
      row.getCell(1).border = thinBorder;
      row.getCell(2).border = thinBorder;
      row.getCell(1).alignment = { vertical: 'middle' };
      row.getCell(2).alignment = { vertical: 'middle' };

      if (item.value instanceof Date) {
        row.getCell(2).numFmt = 'dd-mmm-yyyy hh:mm:ss';
      }
    });

    worksheet.addRow([]);

    const summaryHeaderRow = worksheet.addRow(['Summary', '']);
    worksheet.mergeCells(`A${summaryHeaderRow.number}:B${summaryHeaderRow.number}`);
    summaryHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF111827' } };
    summaryHeaderRow.getCell(1).fill = sectionHeaderFill;
    summaryHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const summaryRows: Array<{ label: string; value: number; format?: string }> = [
      { label: 'Total Purchases', value: Number(reportData.summary.totalPurchases) || 0, format: '#,##0' },
      { label: 'Total Quantity', value: Number(reportData.summary.totalQuantity) || 0, format: '#,##0.00' },
      { label: 'Total Price', value: Number(reportData.summary.totalPrice) || 0, format: '#,##0.00' },
      { label: 'Average Price', value: Number(reportData.summary.averagePrice) || 0, format: '#,##0.00' },
    ];

    summaryRows.forEach((item) => {
      const row = worksheet.addRow([item.label, item.value]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF374151' } };
      row.getCell(1).fill = sectionHeaderFill;
      row.getCell(1).border = thinBorder;
      row.getCell(2).border = thinBorder;
      row.getCell(1).alignment = { vertical: 'middle' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

      if (item.format) {
        row.getCell(2).numFmt = item.format;
      }
    });

    worksheet.eachRow((row) => {
      row.height = 20;
    });

    worksheet.getRow(1).height = 28;
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    worksheet.columns.forEach((column) => {
      let maxLength = 14;
      if (!column.eachCell) {
        column.width = 20;
        return;
      }
      column.eachCell({ includeEmpty: true }, (cell) => {
        const rawValue = cell.value;
        const cellText = typeof rawValue === 'object' && rawValue !== null && 'text' in rawValue
          ? String((rawValue as { text?: string }).text || '')
          : String(rawValue ?? '');
        maxLength = Math.max(maxLength, cellText.length + 2);
      });
      column.width = Math.min(Math.max(maxLength, 18), 45);
    });

    return workbook;
  }

  async generateAndSaveReport(reportType: ReportType, user?: User): Promise<string> {
    const reportData = await this.generateReportData(reportType, user);

    const folderPath = this.getReportFolder(reportType);
    this.ensureDirectoryExists(folderPath);

    const fileName = this.generateReportFileName(reportType, user);
    const filePath = path.join(folderPath, fileName);

    const workbook = await this.createReportWorkbook(reportType, reportData, user);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  private async generateReportBuffer(reportType: ReportType, user?: User): Promise<Buffer> {
    const reportData = await this.generateReportData(reportType, user);
    const workbook = await this.createReportWorkbook(reportType, reportData, user);
    return await workbook.xlsx.writeBuffer() as any;
  }

  private async sendReportEmail(to: string, reportType: ReportType, buffer: Buffer, user?: User): Promise<void> {
    const fileName = this.generateReportFileName(reportType, user);
    const subject = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
    const generatedDate = new Date().toLocaleString();
    const reportTypeDisplay = reportType.charAt(0).toUpperCase() + reportType.slice(1).toLowerCase();
    const branchName = await this.resolveBranchName(user);
    const branchDisplay = user ? `Branch: ${branchName}` : 'All Branches';

    const html = renderTemplate("report-email", {
      reportTypeDisplay,
      reportTypeDisplayLower: reportTypeDisplay.toLowerCase(),
      generatedDate,
      userDisplay: branchDisplay,
    });

    await this.emailService.sendReportEmail(to, subject, html, {
      filename: fileName,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }).catch(() => {});
  }

  async processScheduledReports(userId: number): Promise<string> {
    const activePreferences = await this.reportPreferenceRepository.find({
      where: { userId, isActive: true, isRemoved: false },
      relations: ['user'],
    });

    if (activePreferences.length === 0) {
      return 'No preference is added';
    }

    for (const preference of activePreferences) {
      try {
        if (preference.deliveryMethod === DeliveryMethod.LOCAL_FILE) {
          await this.generateAndSaveReport(preference.reportType, preference.user);
          console.log(`Generated ${preference.reportType} report for branch ${preference.user.branchId}`);
          await this.createReportNotification(preference, preference.reportType, 'saved');
        } else if (preference.deliveryMethod === DeliveryMethod.EMAIL) {
          const reportBuffer = await this.generateReportBuffer(preference.reportType, preference.user);
          await this.sendReportEmail(preference.user.email || preference.user.username, preference.reportType, reportBuffer, preference.user);
          console.log(`Sent ${preference.reportType} report via email to branch ${preference.user.branchId}`);
          await this.createReportNotification(preference, preference.reportType, 'sent');
        }
      } catch (error) {
        console.error(`Failed to generate report for user ${preference.userId}:`, error);
      }
    }

    return 'Scheduled reports generated successfully';
  }

  async runReportNow(reportType: ReportType): Promise<void> {
    await this.processBranchWiseReportType(reportType);
  }

  private async processBranchWiseReportType(reportType: ReportType): Promise<void> {
    const branches = await this.branchRepository.find({
      where: { isRemoved: false },
      select: ['id', 'name'],
    });

    for (const branch of branches) {
      const users = await this.userRepository.find({
        where: { branchId: branch.id, isRemoved: false },
        select: ['id', 'email', 'username', 'branchId', 'role'],
      });

      const recipients = Array.from(
        new Set(
          users
            .map((u) => (u.email || u.username || '').trim())
            .filter((value) => value.length > 0),
        ),
      );

      const branchUser = {
        branchId: branch.id,
        branch,
      } as User;

      try {
        const filePath = await this.generateAndSaveReport(reportType, branchUser);
        console.log(`Generated ${reportType} report for branch ${branch.name} at ${filePath}`);

        if (recipients.length > 0) {
          const reportBuffer = await this.generateReportBuffer(reportType, branchUser);
          await this.sendReportEmail(recipients.join(','), reportType, reportBuffer, branchUser);
          console.log(`Sent ${reportType} report email for branch ${branch.name} to ${recipients.length} user(s)`);
        } else {
          console.warn(`No report recipients found for branch ${branch.name} (${branch.id})`);
        }
      } catch (error) {
        console.error(`Failed to process ${reportType} report for branch ${branch.name} (${branch.id}):`, error);
      }
    }
  }
  
  private async createReportNotification(
    preference: ReportPreference,
    reportType: ReportType,
    action: 'saved' | 'sent'
  ): Promise<void> {
    try {
      const title = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report ${action === 'sent' ? 'Sent' : 'Generated'}`;
      const message = `Your ${reportType.toLowerCase()} report has been ${action === 'sent' ? 'sent via email' : 'saved locally'}.`;

      await this.notificationService.create({
        title,
        message,
        type: NotificationType.USER,
        userId: preference.userId,
      });
    } catch (error) {
      console.error('Failed to create report notification:', error);
    }
  }
}
