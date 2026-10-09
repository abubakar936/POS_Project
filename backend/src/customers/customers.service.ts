import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(dto: CreateCustomerDto) {
    const cust = this.customerRepo.create(dto as any);
    return this.customerRepo.save(cust);
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const qb = this.customerRepo.createQueryBuilder('customer').where('customer.deleted_at IS NULL');

    if (query.search) {
      qb.andWhere(
        '(customer.first_name ILIKE :s OR customer.last_name ILIKE :s OR customer.full_name ILIKE :s OR customer.email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('customer.created_at', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const cust = await this.customerRepo.findOne({ where: { id, deleted_at: IsNull() } as any });
    if (!cust) throw new NotFoundException('Customer not found');
    return cust;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const cust = await this.findOne(id);
    Object.assign(cust, dto as any);
    return this.customerRepo.save(cust);
  }

  async remove(id: string) {
    const cust = await this.findOne(id);
    return this.customerRepo.softDelete(cust.id);
  }
}
