import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto, UpdatePurchaseDto, PurchaseResponseDto } from './dto/purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('purchase')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  create(@Body() createPurchaseDto: CreatePurchaseDto, @Request() req) {
    return this.purchaseService.create(createPurchaseDto, req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.purchaseService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePurchaseDto: UpdatePurchaseDto) {
    return this.purchaseService.update(+id, updatePurchaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchaseService.remove(+id);
  }
}
