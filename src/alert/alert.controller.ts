import { Controller, Get, Post, Body, Put, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { DismissAlertDto } from './dto/dismiss-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlertStatus } from '../shared/enums/alert-status.enum';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  create(@Body() createAlertDto: CreateAlertDto) {
    return this.alertService.create(createAlertDto);
  }

  @Get('branch/:branchId')
  findByBranch(
    @Param('branchId') branchId: string,
    @Query('status') status?: AlertStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? +page : 1;
    const limitNum = limit ? +limit : 10;
    return this.alertService.findByBranch(+branchId, status, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertService.findOne(+id);
  }

  @Put(':id/resolve')
  resolve(@Param('id') id: string, @Body() resolveAlertDto: ResolveAlertDto) {
    return this.alertService.resolve(+id, resolveAlertDto);
  }

  @Put(':id/dismiss')
  dismiss(@Param('id') id: string, @Body() dismissAlertDto?: DismissAlertDto) {
    return this.alertService.dismiss(+id, dismissAlertDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAlertDto: UpdateAlertDto) {
    return this.alertService.update(+id, updateAlertDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alertService.remove(+id);
  }
}
