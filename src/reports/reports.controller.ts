import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReportPreferenceDto } from './dto/create-report-preference.dto';
import { UpdateReportPreferenceDto } from './dto/update-report-preference.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  async getDailyReport(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    return this.reportsService.getDailyReport(userIdNum);
  }

  @Get('weekly')
  async getWeeklyReport(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    return this.reportsService.getWeeklyReport(userIdNum);
  }

  @Get('monthly')
  async getMonthlyReport(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    return this.reportsService.getMonthlyReport(userIdNum);
  }

  @Get('half-yearly')
  async getHalfYearlyReport(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    return this.reportsService.getHalfYearlyReport(userIdNum);
  }

  @Get('yearly')
  async getYearlyReport(@Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    return this.reportsService.getYearlyReport(userIdNum);
  }

  @Post('preferences')
  async createPreference(@Body() createDto: CreateReportPreferenceDto, @Request() req) {
    return this.reportsService.createPreference(req.user.id, createDto);
  }

  @Get('preferences')
  async getUserPreferences(@Request() req) {
    return this.reportsService.findUserPreferences(req.user.id);
  }

  @Put('preferences/:id')
  async updatePreference(@Param('id') id: string, @Body() updateDto: UpdateReportPreferenceDto) {
    return this.reportsService.updatePreference(parseInt(id), updateDto);
  }

  @Delete('preferences/:id')
  async removePreference(@Param('id') id: string) {
    return this.reportsService.removePreference(parseInt(id));
  }

  @Post('generate-scheduled')
  async generateScheduledReports() {
    await this.reportsService.processScheduledReports();
    return { message: 'Scheduled reports generated successfully' };
  }

  @Post('generate/:reportType')
  async generateReport(@Param('reportType') reportType: string, @Query('userId') userId?: string) {
    const userIdNum = userId ? parseInt(userId) : undefined;
    const filePath = await this.reportsService.generateAndSaveReport(reportType as any, userIdNum);
    return {
      message: 'Report generated and saved successfully',
      filePath
    };
  }
}