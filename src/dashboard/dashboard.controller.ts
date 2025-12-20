import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { StockAlert } from '../alert/entities/alert.entity';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Admin Dashboard APIs
  @Get('admin/:userId/total-inventory')
  async getTotalInventory(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getTotalInventory(userId);
    return { count };
  }

  @Get('admin/active-branches')
  async getActiveBranches(): Promise<{ count: number }> {
    const count = await this.dashboardService.getActiveBranches();
    return { count };
  }

  @Get('admin/:userId/monthly-sales')
  async getMonthlySales(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getMonthlySales(userId);
    return { count };
  }

  @Get('admin/:userId/pending-requests')
  async getPendingRequests(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getPendingRequests(userId);
    return { count };
  }

  @Get(':userId/active-alerts-list')
  async getActiveAlertsList(@Param('userId', ParseIntPipe) userId: number): Promise<StockAlert[]> {
    return await this.dashboardService.getActiveAlertsList(userId);
  }

  // Branch Dashboard APIs
  @Get('branch/:userId/current-stock')
  async getCurrentStock(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getCurrentStock(userId);
    return { count };
  }

  @Get('branch/:userId/active-alerts')
  async getActiveAlerts(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getActiveAlerts(userId);
    return { count };
  }

  @Get('branch/:userId/pending-orders')
  async getPendingOrders(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getPendingOrders(userId);
    return { count };
  }

  @Get('branch/:userId/todays-buys')
  async getTodaysbuys(@Param('userId', ParseIntPipe) userId: number): Promise<{ count: number }> {
    const count = await this.dashboardService.getTodaysbuys(userId);
    return { count };
  }
}