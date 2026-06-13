import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Stock } from './stock.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Product } from '../products/product.entity';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(Stock)
    private readonly repo: Repository<Stock>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(dto: CreateStockDto) {
    const product = await this.productRepo.findOne({ where: { id: dto.productId, deletedAt: IsNull() } });
    if (!product) throw new BadRequestException('Product not found');

    const entity = this.repo.create({
      productId: dto.productId,
      quantity: dto.quantity,
      remainingQuantity: dto.remainingQuantity ?? dto.quantity,
      minimumQuantity: dto.minimumQuantity ?? null,
      locationType: dto.locationType,
      rackLocation: dto.rackLocation ?? null,
      purchasePrice: dto.purchasePrice,
      salePrice: dto.salePrice,
      printedPrice: dto.printedPrice ?? null,
      totalPurchaseValue: dto.totalPurchaseValue ?? null,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
    });

    return this.repo.save(entity);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; productId?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const qb = this.repo.createQueryBuilder('s').where('s.deletedAt IS NULL');
    qb.leftJoinAndSelect('s.product', 'product');

    if (query.productId) qb.andWhere('s.productId = :productId', { productId: query.productId });
    if (query.search) qb.andWhere('product.name ILIKE :search', { search: `%${query.search}%` });

    const [data, total] = await qb.orderBy('s.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return { data, meta: { page, limit, total, totalPages } };
  }

  async findOne(id: string) {
    const stock = await this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.product', 'product')
      .where('s.id = :id', { id })
      .andWhere('s.deletedAt IS NULL')
      .getOne();

    if (!stock) throw new NotFoundException('Stock not found');
    return stock;
  }

  async update(id: string, dto: UpdateStockDto) {
    const stock = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!stock) throw new NotFoundException('Stock not found');

    if ((dto as any).productId) {
      const product = await this.productRepo.findOne({ where: { id: (dto as any).productId, deletedAt: IsNull() } });
      if (!product) throw new BadRequestException('Product not found');
    }

    Object.assign(stock, dto);
    if ((dto as any).purchaseDate) stock.purchaseDate = new Date((dto as any).purchaseDate);
    return this.repo.save(stock);
  }

  async remove(id: string) {
    const stock = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!stock) throw new NotFoundException('Stock not found');

    await this.repo.softDelete(id);
    return { success: true };
  }
}
