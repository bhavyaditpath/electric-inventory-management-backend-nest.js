import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, AdminOnlyGuard } from '../shared/guards';
import { Roles, CurrentUser } from '../shared/decorators';
import { UserRole } from '../shared/enums/role.enum';
import { User } from '../user/entities/user.entity';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

@Controller('request')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Get('admins')
  @Roles(UserRole.BRANCH)
  getAdminsForDropdown(@Request() req, @Query('productName') productName?: string) {
    return this.requestService.getAdminsForDropdown(productName, req.user as User);
  }

  @Post()
  create(@Body() createRequestDto: CreateRequestDto, @Request() req) {
    return this.requestService.create(createRequestDto, req.user as User);
  }

  @Get()
  findAll(@Request() req, @Query() query: PaginationQueryDto) {
    return this.requestService.findAll(req.user as User, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.requestService.findOne(+id, req.user as User);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRequestDto: UpdateRequestDto, @Request() req) {
    return this.requestService.update(+id, updateRequestDto, req.user as User);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requestService.remove(+id);
  }
}
