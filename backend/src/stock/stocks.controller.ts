import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StocksService } from './stocks.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateStockSalePriceDto } from './dto/update-stock-sale-price.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stocks')
@UseGuards(JwtAuthGuard)
export class StocksController {
  constructor(private readonly svc: StocksService) {}

  @Post()
  create(@Body() dto: CreateStockDto) {
    return this.svc.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('productId') productId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.svc.findAll({
      page: Number(page),
      limit: Number(limit),
      search,
      productId,
      vendorId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/sale-price')
  updateSalePrice(
    @Param('id') id: string,
    @Body() dto: UpdateStockSalePriceDto,
  ) {
    return this.svc.updateSalePrice(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
