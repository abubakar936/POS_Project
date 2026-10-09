import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  formatScaledDecimal,
  MAX_MONEY_CENTS,
  parseScaledDecimal,
} from '../common/decimal.util';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoicePaymentDto } from './dto/create-invoice-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicePayment } from './invoice-payment.entity';
import { Invoice } from './invoice.entity';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoicePayment)
    private readonly paymentRepo: Repository<InvoicePayment>,
  ) {}

  async create(dto: CreateInvoiceDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: dto.orderId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new BadRequestException('Order not found');

      const existing = await manager.getRepository(Invoice).findOne({
        withDeleted: true,
        where: { orderId: order.id },
      });
      if (existing) {
        throw new ConflictException('An invoice already exists for this order');
      }

      const items = await manager.getRepository(OrderItem).find({
        where: { orderId: order.id },
      });
      if (items.length === 0) {
        throw new ConflictException(
          'An invoice cannot be created for an empty order',
        );
      }

      const invoice = manager.getRepository(Invoice).create({
        invoiceNumber: `INV-${randomUUID().toUpperCase()}`,
        orderId: order.id,
        customerId: order.customerId ?? null,
        customerName: order.customerName ?? null,
        customerPhone: order.customerPhone ?? null,
        customerAddress: order.customerAddress ?? null,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        itemDiscountAmount: order.itemDiscountAmount,
        totalAmount: order.totalAmount,
        note: dto.note ?? order.note ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      });
      const saved = await manager.getRepository(Invoice).save(invoice);
      return this.findOneWithManager(manager, saved.id);
    });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .where('invoice.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(invoice.invoiceNumber ILIKE :search OR invoice.customerName ILIKE :search OR invoice.customerPhone ILIKE :search OR order.orderNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [invoices, total] = await qb
      .orderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const paymentGroups = await this.getPaymentsForInvoices(
      invoices.map((invoice) => invoice.id),
      this.paymentRepo,
    );

    return {
      data: invoices.map((invoice) =>
        this.withPaymentSummary(invoice, paymentGroups.get(invoice.id) ?? []),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: string) {
    const invoice = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .leftJoinAndSelect('order.items', 'item')
      .where('invoice.id = :id', { id })
      .andWhere('invoice.deletedAt IS NULL')
      .getOne();
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payments = await this.paymentRepo.find({
      where: { invoiceId: id },
      order: { createdAt: 'ASC' },
    });
    return this.withPaymentSummary(invoice, payments);
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    await this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      if (dto.note !== undefined) invoice.note = dto.note;
      if (dto.dueDate !== undefined) {
        invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }
      await manager.getRepository(Invoice).save(invoice);
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const activePayments = await manager.getRepository(InvoicePayment).count({
        where: { invoiceId: id },
      });
      if (activePayments > 0) {
        throw new ConflictException(
          'Remove invoice payments before deleting the invoice',
        );
      }

      await manager.getRepository(Invoice).softDelete(id);
      return { success: true };
    });
  }

  async addPayment(id: string, dto: CreateInvoicePaymentDto) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const payments = await manager.getRepository(InvoicePayment).find({
        where: { invoiceId: id },
      });
      const paid = payments.reduce(
        (sum, payment) => sum + parseScaledDecimal(payment.amount, 2),
        0n,
      );
      const amount = parseScaledDecimal(dto.amount, 2);
      const total = parseScaledDecimal(invoice.totalAmount, 2);
      if (amount <= 0n) {
        throw new BadRequestException(
          'Payment amount must be greater than zero',
        );
      }
      if (amount > MAX_MONEY_CENTS) {
        throw new BadRequestException('Payment amount is too large');
      }
      if (paid + amount > total) {
        throw new BadRequestException('Payment exceeds the invoice balance');
      }

      await manager.getRepository(InvoicePayment).save(
        manager.getRepository(InvoicePayment).create({
          invoiceId: id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
        }),
      );
      return this.findOneWithManager(manager, id);
    });
  }

  async findPayments(id: string) {
    await this.ensureInvoiceExists(id, this.invoiceRepo);
    return this.paymentRepo.find({
      where: { invoiceId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async removePayment(id: string, paymentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const payment = await manager.getRepository(InvoicePayment).findOne({
        where: { id: paymentId, invoiceId: id },
      });
      if (!payment) throw new NotFoundException('Invoice payment not found');

      await manager.getRepository(InvoicePayment).softDelete(paymentId);
      return this.findOneWithManager(manager, id);
    });
  }

  private async findOneWithManager(manager: EntityManager, id: string) {
    const invoice = await manager
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .leftJoinAndSelect('order.items', 'item')
      .where('invoice.id = :id', { id })
      .getOne();
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payments = await manager.getRepository(InvoicePayment).find({
      where: { invoiceId: id },
      order: { createdAt: 'ASC' },
    });
    return this.withPaymentSummary(invoice, payments);
  }

  private async getPaymentsForInvoices(
    ids: string[],
    repository: Repository<InvoicePayment>,
  ) {
    const groups = new Map<string, InvoicePayment[]>();
    if (ids.length === 0) return groups;

    const payments = await repository.find({
      where: { invoiceId: In(ids) },
      order: { createdAt: 'ASC' },
    });
    for (const payment of payments) {
      const group = groups.get(payment.invoiceId) ?? [];
      group.push(payment);
      groups.set(payment.invoiceId, group);
    }
    return groups;
  }

  private withPaymentSummary(invoice: Invoice, payments: InvoicePayment[]) {
    const amountPaid = payments.reduce(
      (sum, payment) => sum + parseScaledDecimal(payment.amount, 2),
      0n,
    );
    const total = parseScaledDecimal(invoice.totalAmount, 2);
    const balanceDue = total - amountPaid;
    return {
      ...invoice,
      payments,
      amountPaid: formatScaledDecimal(amountPaid, 2),
      balanceDue: formatScaledDecimal(balanceDue, 2),
      status:
        balanceDue === 0n
          ? 'PAID'
          : amountPaid === 0n
            ? 'UNPAID'
            : 'PARTIALLY_PAID',
    };
  }

  private async ensureInvoiceExists(
    id: string,
    repository: Repository<Invoice>,
  ) {
    const invoice = await repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
  }
}
