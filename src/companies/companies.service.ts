import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
  ) {}

  async create(dto: CreateCompanyDto) {
    const entity = this.repo.create({
      ...dto,
      email: dto.email ?? null,
      phone1: dto.phone1 ?? null,
      phone2: dto.phone2 ?? null,
      address1: dto.address1 ?? null,
      address2: dto.address2 ?? null,
      note: dto.note ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.repo.save(entity);
  }

  async findAll(query: { page?: number; limit?: number; search?: string; isActive?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const qb = this.repo.createQueryBuilder('c').where('c.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('(c.name ILIKE :q OR c.email ILIKE :q OR c.phone1 ILIKE :q)', { q: `%${query.search}%` });
    }

    if (query.isActive !== undefined) qb.andWhere('c.isActive = :isActive', { isActive: query.isActive === 'true' });

    const [data, total] = await qb.orderBy('c.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return { data, meta: { page, limit, total, totalPages } };
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const c = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Company not found');

    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string) {
    const c = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Company not found');

    await this.repo.softDelete(id);
    return { success: true };
  }
}
