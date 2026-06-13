import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../categories/category.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(SubCategory)
    private readonly subRepo: Repository<SubCategory>,
  ) {}

  async create(dto: CreateProductDto) {
    if (dto.categoryId) {
      const cat = await this.categoryRepo.findOne({ where: { id: dto.categoryId, deletedAt: IsNull(), isActive: true } });
      if (!cat) throw new BadRequestException('Category not found or inactive');
    }

    if (dto.subCategoryId) {
      const sub = await this.subRepo.findOne({ where: { id: dto.subCategoryId, deletedAt: IsNull(), isActive: true } });
      if (!sub) throw new BadRequestException('SubCategory not found or inactive');
    }

    const entity = this.repo.create({
      name: dto.name,
      sku: dto.sku ?? null,
      barcode: dto.barcode ?? null,
      categoryId: dto.categoryId ?? null,
      subCategoryId: dto.subCategoryId ?? null,
      companyId: dto.companyId ?? null,
      vendorId: dto.vendorId ?? null,
      measuringUnit: dto.measuringUnit ?? null,
      packSize: dto.packSize ?? null,
      pcsPerCarton: dto.pcsPerCarton ?? null,
      retailPrice: dto.retailPrice ?? null,
      salePrice: dto.salePrice ?? null,
      purchasePrice: dto.purchasePrice ?? null,
      isPricePrinted: dto.isPricePrinted ?? false,
      printedPrice: dto.printedPrice ?? null,
      hasVariants: dto.hasVariants ?? false,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    try {
      return await this.repo.save(entity);
    } catch (err) {
      throw new ConflictException('Could not create product');
    }
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const qb = this.repo.createQueryBuilder('p').where('p.deletedAt IS NULL');
    qb.leftJoinAndSelect('p.category', 'category');
    qb.leftJoinAndSelect('p.subCategory', 'subCategory');

    if (query.search) qb.andWhere('p.name ILIKE :search', { search: `%${query.search}%` });
    if (query.isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive: query.isActive === 'true' });

    const [data, total] = await qb.orderBy('p.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return { data, meta: { page, limit, total, totalPages } };
  }

  async findOne(id: string) {
    const product = await this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.subCategory', 'subCategory')
      .leftJoinAndSelect('p.parentProduct', 'parentProduct')
      .where('p.id = :id', { id })
      .andWhere('p.deletedAt IS NULL')
      .getOne();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!product) throw new NotFoundException('Product not found');

    if ((dto as any).categoryId) {
      const cat = await this.categoryRepo.findOne({ where: { id: (dto as any).categoryId, deletedAt: IsNull(), isActive: true } });
      if (!cat) throw new BadRequestException('Category not found or inactive');
    }

    if ((dto as any).subCategoryId) {
      const sub = await this.subRepo.findOne({ where: { id: (dto as any).subCategoryId, deletedAt: IsNull(), isActive: true } });
      if (!sub) throw new BadRequestException('SubCategory not found or inactive');
    }

    Object.assign(product, dto);
    try {
      return await this.repo.save(product);
    } catch (err) {
      throw new ConflictException('Could not update product');
    }
  }

  async remove(id: string) {
    const product = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!product) throw new NotFoundException('Product not found');

    await this.repo.softDelete(id);
    return { success: true };
  }
}
