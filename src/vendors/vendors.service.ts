import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Vendor } from './vendor.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly repo: Repository<Vendor>,
  ) {}

  async create(dto: CreateVendorDto) {
    const entity = this.repo.create({
      ...dto,
      companyName: dto.companyName ?? null,
      email: dto.email ?? null,
      phone1: dto.phone1 ?? null,
      phone2: dto.phone2 ?? null,
      address1: dto.address1 ?? null,
      address2: dto.address2 ?? null,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.repo.save(entity);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const qb = this.repo.createQueryBuilder('vendor').where('vendor.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(vendor.name ILIKE :q OR vendor.companyName ILIKE :q OR vendor.email ILIKE :q OR vendor.phone1 ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }

    if (query.isActive !== undefined) qb.andWhere('vendor.isActive = :isActive', { isActive: query.isActive === 'true' });

    const [data, total] = await qb.orderBy('vendor.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return { data, meta: { page, limit, total, totalPages } };
  }

  async findOne(id: string) {
    const v = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!v) throw new NotFoundException('Vendor not found');
    return v;
  }

  async update(id: string, dto: UpdateVendorDto) {
    const v = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!v) throw new NotFoundException('Vendor not found');

    Object.assign(v, dto);
    return this.repo.save(v);
  }

  async remove(id: string) {
    const v = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!v) throw new NotFoundException('Vendor not found');

    await this.repo.softDelete(id);
    return { success: true };
  }
}
