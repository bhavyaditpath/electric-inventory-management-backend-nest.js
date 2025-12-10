import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { ApiResponseUtil } from '../shared/api-response';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  async create(@Body() createBranchDto: CreateBranchDto) {
    try {
      const result = await this.branchService.create(createBranchDto);
      return ApiResponseUtil.success(result, 'Branch created successfully');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to create branch');
    }
  }

  @Get()
  async findAll(@Query() paginationQuery: PaginationQueryDto) {
    const { page, pageSize } = paginationQuery;
    const result = await this.branchService.findAll(page, pageSize);
    return ApiResponseUtil.success(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return ApiResponseUtil.success(await this.branchService.findOne(+id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    try {
      const result = await this.branchService.update(+id, updateBranchDto);
      return ApiResponseUtil.success(result, 'Branch updated successfully');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to update branch');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return ApiResponseUtil.success(await this.branchService.remove(+id));
  }
}
