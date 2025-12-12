import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReportPreferenceDto } from './dto/create-report-preference.dto';
import { UpdateReportPreferenceDto } from './dto/update-report-preference.dto';
import { ApiResponse } from '../shared/api-response';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  async getDailyReport(@Request() req) {
    return this.reportsService.getDailyReport(req.user.id);
  }

  @Get('weekly')
  async getWeeklyReport(@Request() req) {
    return this.reportsService.getWeeklyReport(req.user.id);
  }

  @Get('monthly')
  async getMonthlyReport(@Request() req) {
    return this.reportsService.getMonthlyReport(req.user.id);
  }

  @Get('half-yearly')
  async getHalfYearlyReport(@Request() req) {
    return this.reportsService.getHalfYearlyReport(req.user.id);
  }

  @Get('yearly')
  async getYearlyReport(@Request() req) {
    return this.reportsService.getYearlyReport(req.user.id);
  }

  @Post('preferences')
  async createPreference(@Body() createDto: CreateReportPreferenceDto, @Request() req): Promise<ApiResponse> {
    return this.reportsService.createPreference(req.user.id, createDto);
  }

  @Get('preferences')
  async getUserPreferences(@Request() req) {
    return this.reportsService.findUserPreferences(req.user.id);
  }

  @Put('preferences/:id')
  async updatePreference(@Param('id') id: string, @Body() updateDto: UpdateReportPreferenceDto): Promise<ApiResponse> {
    return this.reportsService.updatePreference(parseInt(id), updateDto);
  }

  @Delete('preferences/:id')
  async removePreference(@Param('id') id: string): Promise<ApiResponse> {
    return this.reportsService.removePreference(parseInt(id));
  }

  @Post('generate-scheduled')
  async generateScheduledReports() {
    await this.reportsService.processScheduledReports();
    return { message: 'Scheduled reports generated successfully' };
  }

  @Post('generate/:reportType')
  async generateReport(@Param('reportType') reportType: string, @Request() req) {
    const filePath = await this.reportsService.generateAndSaveReport(reportType as any, req.user.id);
    return {
      message: 'Report generated and saved successfully',
      filePath
    };
  }
}