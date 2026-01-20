import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards';
import { CurrentUser } from '../shared/decorators';
import { CreateReportPreferenceDto } from './dto/create-report-preference.dto';
import { UpdateReportPreferenceDto } from './dto/update-report-preference.dto';
import { ApiResponse } from '../shared/api-response';
import { User } from '../user/entities/user.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  async getDailyReport(@CurrentUser() user: User) {
    return this.reportsService.getDailyReport(user);
  }

  @Get('weekly')
  async getWeeklyReport(@CurrentUser() user: User) {
    return this.reportsService.getWeeklyReport(user);
  }

  @Get('monthly')
  async getMonthlyReport(@CurrentUser() user: User) {
    return this.reportsService.getMonthlyReport(user);
  }

  @Get('half-yearly')
  async getHalfYearlyReport(@CurrentUser() user: User) {
    return this.reportsService.getHalfYearlyReport(user);
  }

  @Get('yearly')
  async getYearlyReport(@CurrentUser() user: User) {
    return this.reportsService.getYearlyReport(user);
  }

  @Post('preferences')
  async createPreference(@Body() createDto: CreateReportPreferenceDto, @CurrentUser() user: User): Promise<ApiResponse> {
    return this.reportsService.createPreference(user.id, createDto);
  }

  @Get('preferences')
  async getUserPreferences(@CurrentUser() user: User) {
    return this.reportsService.findUserPreferences(user.id);
  }

  @Put('preferences/:id')
  async updatePreference(@Param('id') id: string, @Body() updateDto: UpdateReportPreferenceDto, @CurrentUser() user: User): Promise<ApiResponse> {
    return this.reportsService.updatePreference(parseInt(id), updateDto);
  }

  @Delete('preferences/:id')
  async removePreference(@Param('id') id: string, @CurrentUser() user: User): Promise<ApiResponse> {
    return this.reportsService.removePreference(parseInt(id));
  }

  @Post('generate-scheduled')
  async generateScheduledReports() {
    await this.reportsService.processScheduledReports();
    return { message: 'Scheduled reports generated successfully' };
  }

  @Post('generate/:reportType')
  async generateReport(@Param('reportType') reportType: string, @CurrentUser() user: User) {
    const filePath = await this.reportsService.generateAndSaveReport(reportType as any, user);
    return {
      message: 'Report generated and saved successfully',
      filePath
    };
  }
}