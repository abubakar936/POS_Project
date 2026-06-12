import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubCategoriesController } from './sub-categories.controller';
import { SubCategoriesService } from './sub-categories.service';
import { SubCategory } from './sub-category.entity';
import { Category } from '../categories/category.entity';
import { CategoriesModule } from '../categories/categories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SubCategory, Category]), forwardRef(() => CategoriesModule), forwardRef(() => AuthModule)],
  controllers: [SubCategoriesController],
  providers: [SubCategoriesService],
  exports: [SubCategoriesService, TypeOrmModule],
})
export class SubCategoriesModule {}
