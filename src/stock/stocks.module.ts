import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { Stock } from './stock.entity';
import { Product } from '../products/product.entity';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, Product]), forwardRef(() => ProductsModule), forwardRef(() => AuthModule)],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService, TypeOrmModule],
})
export class StocksModule {}
