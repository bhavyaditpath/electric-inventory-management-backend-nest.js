import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';

@Controller('request')
@UseGuards(JwtAuthGuard)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Get('admins')
  getAdminsForDropdown() {
    return this.requestService.getAdminsForDropdown();
  }

  @Post()
  create(@Body() createRequestDto: CreateRequestDto, @Request() req) {
    return this.requestService.create(createRequestDto, req.user as User);
  }

  @Get()
  findAll(@Request() req) {
    return this.requestService.findAll(req.user as User);
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
