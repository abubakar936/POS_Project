import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';
import { SubCategoriesModule } from '../sub-categories/sub-categories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, SubCategory]), forwardRef(() => SubCategoriesModule), forwardRef(() => AuthModule)],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService, TypeOrmModule,],
})
export class CategoriesModule {}
