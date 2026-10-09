import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SubCategory } from './sub-category.entity';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { Category } from '../categories/category.entity';

@Injectable()
export class SubCategoriesService {
  constructor(
    @InjectRepository(SubCategory)
    private readonly subRepo: Repository<SubCategory>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async create(dto: CreateSubCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId, isActive: true, deletedAt: IsNull() } });
    if (!category) throw new BadRequestException('Category not found or inactive');

    const exists = await this.subRepo.findOne({ where: { name: dto.name, categoryId: dto.categoryId, deletedAt: IsNull() } });
    if (exists) throw new ConflictException('SubCategory with this name already exists in the category');

    const entity = this.subRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      isActive: dto.isActive ?? true,
    });

    return this.subRepo.save(entity);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const qb = this.subRepo.createQueryBuilder('sub').where('sub.deletedAt IS NULL');
    qb.leftJoinAndSelect('sub.category', 'category');

    if (query.search) qb.andWhere('sub.name ILIKE :search', { search: `%${query.search}%` });
    if (query.isActive !== undefined) qb.andWhere('sub.isActive = :isActive', { isActive: query.isActive === 'true' });

    const [data, total] = await qb.orderBy('sub.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return { data, meta: { page, limit, total, totalPages } };
  }

  async findOne(id: string) {
    const sub = await this.subRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.category', 'category')
      .where('sub.id = :id', { id })
      .andWhere('sub.deletedAt IS NULL')
      .getOne();
    if (!sub) throw new NotFoundException('SubCategory not found');
    return sub;
  }

  async update(id: string, dto: UpdateSubCategoryDto) {
    const sub = await this.subRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!sub) throw new NotFoundException('SubCategory not found');

    if ((dto as any).categoryId && (dto as any).categoryId !== sub.categoryId) {
      const category = await this.categoryRepo.findOne({ where: { id: (dto as any).categoryId, isActive: true, deletedAt: IsNull() } });
      if (!category) throw new BadRequestException('Category not found or inactive');
    }

    const newCategoryId = (dto as any).categoryId ?? sub.categoryId;
    const newName = (dto as any).name ?? sub.name;

    const exists = await this.subRepo.findOne({ where: { name: newName, categoryId: newCategoryId, deletedAt: IsNull() } });
    if (exists && exists.id !== id) throw new ConflictException('SubCategory with this name already exists in the category');

    Object.assign(sub, dto);
    return this.subRepo.save(sub);
  }

  async remove(id: string) {
    const sub = await this.subRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!sub) throw new NotFoundException('SubCategory not found');

    await this.subRepo.softDelete(id);
    return { success: true };
  }
}
