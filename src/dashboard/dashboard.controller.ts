import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { StockAlert } from '../alert/entities/alert.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, BranchAccessGuard } from '../shared/guards';
import { Roles, CurrentUser } from '../shared/decorators';
import { UserRole } from '../shared/enums/role.enum';
import { User } from '../user/entities/user.entity';
import { PurchaseTrendQueryDto } from './dto/purchase-trend-query.dto';
import { SalesPurchaseTrendQueryDto } from './dto/sales-purchase-trend-query.dto';
import { StockHealthQueryDto } from './dto/stock-health-query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Admin Dashboard APIs
  @Get('admin/total-inventory')
  @Roles(UserRole.ADMIN)
  async getTotalInventory(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getTotalInventory(user);
    return { count };
  }

  @Get('admin/active-branches')
  @Roles(UserRole.ADMIN)
  async getActiveBranches(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getActiveBranches();
    return { count };
  }

  @Get('admin/monthly-sales')
  @Roles(UserRole.ADMIN)
  async getMonthlySales(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getMonthlySales(user);
    return { count };
  }

  @Get('admin/pending-requests')
  @Roles(UserRole.ADMIN)
  async getPendingRequests(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getPendingRequests(user);
    return { count };
  }

  @Get(':userId/active-alerts-list')
  async getActiveAlertsList(@Param('userId', ParseIntPipe) userId: number): Promise<StockAlert[]> {
    return await this.dashboardService.getActiveAlertsList(userId);
  }

  // Branch Dashboard APIs
  @Get('branch/current-stock')
  @Roles(UserRole.BRANCH)
  async getCurrentStock(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getCurrentStock(user);
    return { count };
  }

  @Get('branch/:userId/active-alerts')
  @Roles(UserRole.BRANCH)
  async getActiveAlerts(@Param('userId', ParseIntPipe) userId: number, @CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getActiveAlerts(userId);
    return { count };
  }

  @Get('branch/pending-orders')
  @Roles(UserRole.BRANCH)
  async getPendingOrders(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getPendingOrders(user);
    return { count };
  }

  @Get('branch/todays-buys')
  @Roles(UserRole.BRANCH)
  async getTodaysbuys(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.dashboardService.getTodaysbuys(user);
    return { count };
  }

  @Get('purchase-trend')
  @Roles(UserRole.ADMIN, UserRole.BRANCH)
  async getPurchaseTrend(@CurrentUser() user: User, @Query() query: PurchaseTrendQueryDto) {
    return this.dashboardService.getPurchaseTrend(user, query);
  }

  @Get('sales-vs-purchase-trend')
  @Roles(UserRole.ADMIN, UserRole.BRANCH)
  async getSalesVsPurchaseTrend(@CurrentUser() user: User, @Query() query: SalesPurchaseTrendQueryDto) {
    return this.dashboardService.getSalesVsPurchaseTrend(user, query);
  }

  @Get('stock-health-distribution')
  @Roles(UserRole.ADMIN, UserRole.BRANCH)
  async getStockHealthDistribution(@CurrentUser() user: User, @Query() query: StockHealthQueryDto) {
    return this.dashboardService.getStockHealthDistribution(user, query);
  }
}
