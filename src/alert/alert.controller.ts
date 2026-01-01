import { Controller, Get, Post, Body, Put, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { DismissAlertDto } from './dto/dismiss-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, AdminOnlyGuard, BranchAccessGuard } from '../shared/guards';
import { Roles, CurrentUser } from '../shared/decorators';
import { UserRole } from '../shared/enums/role.enum';
import { AlertStatus } from '../shared/enums/alert-status.enum';
import { User } from '../user/entities/user.entity';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(AdminOnlyGuard)
  create(@Body() createAlertDto: CreateAlertDto) {
    return this.alertService.create(createAlertDto);
  }

  @Get('branch/:branchId')
  @UseGuards(BranchAccessGuard)
  findByBranch(
    @Param('branchId') branchId: string,
    @CurrentUser() user: User,
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
