import { Controller, Get, UseGuards, Request, Query, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { ApiResponseUtil } from 'src/shared/api-response';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Get()
  async findAll(@Req() req, @Query() query: PaginationQueryDto) {
    const result = await this.inventoryService.findAll(req.user, query);
    return ApiResponseUtil.success(result);
  }

  @Get('summary')
  async getStockSummary(
    @Req() req: any,
    @Query('search') search?: string,
  ) {
    const summary = await this.inventoryService.getStockSummary(req.user, search);
    return ApiResponseUtil.success(summary);
  }
}
