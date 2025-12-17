import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';
import { ApiResponseUtil } from '../shared/api-response';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() userDto: UserDto) {
    return this.userService.create(userDto);
  }

  @Get()
  async findAll(@Query() paginationQuery: PaginationQueryDto) {
    const { page, pageSize, search, sortBy, sortOrder } = paginationQuery;
    return this.userService.findAll(page, pageSize, search, sortBy, sortOrder);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() userDto: UserDto) {
    return this.userService.update(id, userDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
