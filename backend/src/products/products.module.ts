import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';
import { CategoriesModule } from '../categories/categories.module';
import { SubCategoriesModule } from '../sub-categories/sub-categories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, SubCategory]),
    forwardRef(() => CategoriesModule),
    forwardRef(() => SubCategoriesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}
