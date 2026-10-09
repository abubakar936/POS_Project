import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SubCategory } from '../sub-categories/sub-category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(SubCategory)
    private readonly subCategoryRepository: Repository<SubCategory>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const exists = await this.categoryRepository.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Category with this name already exists');

    const entity = this.categoryRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.categoryRepository.save(entity);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const qb = this.categoryRepository.createQueryBuilder('category').where('category.deletedAt IS NULL');

    if (query.search) qb.andWhere('category.name ILIKE :search', { search: `%${query.search}%` });
    if (query.isActive !== undefined) qb.andWhere('category.isActive = :isActive', { isActive: query.isActive === 'true' });

    const [data, total] = await qb
      .orderBy('category.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: { page, limit, total, totalPages },
    };
  }

  async findOne(id: string) {
    const cat = await this.categoryRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const cat = await this.categoryRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!cat) throw new NotFoundException('Category not found');

    if ((dto as any).name && (dto as any).name !== cat.name) {
      const exists = await this.categoryRepository.findOne({ where: { name: (dto as any).name } });
      if (exists) throw new ConflictException('Category with this name already exists');
    }

    Object.assign(cat, dto);
    return this.categoryRepository.save(cat);
  }

  async remove(id: string) {
    const cat = await this.categoryRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!cat) throw new NotFoundException('Category not found');

    const activeCount = await this.subCategoryRepository.count({ where: { categoryId: id, isActive: true, deletedAt: IsNull() } });
    if (activeCount > 0) throw new BadRequestException('Category cannot be deleted while active subcategories exist');

    await this.categoryRepository.softDelete(id);
    return { success: true };
  }
}
