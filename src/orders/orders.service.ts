import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import {
  calculateLineTotal,
  formatScaledDecimal,
  MAX_MONEY_CENTS,
  parseScaledDecimal,
} from '../common/decimal.util';
import { Invoice } from '../invoices/invoice.entity';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';

interface PreparedItem {
  product: Product;
  stock: Stock;
  quantity: bigint;
  salePrice: bigint;
  discount: bigint;
  lineTotal: bigint;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async create(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const customer = await this.resolveCustomer(manager, dto.customerId);
      const items = await this.prepareItems(manager, dto.items);
      const requestedByStock = this.sumQuantitiesByStock(items);
      const stocks = [
        ...new Map(items.map((item) => [item.stock.id, item.stock])).values(),
      ];
      this.assertStockAvailability(stocks, requestedByStock);

      const summary = this.calculateSummary(
        items,
        parseScaledDecimal(dto.discountAmount ?? '0', 2),
      );
      await this.adjustStock(manager, stocks, requestedByStock, -1n);

      const order = manager.getRepository(Order).create({
        orderNumber: `ORD-${randomUUID().toUpperCase()}`,
        customerId: customer?.id ?? null,
        customer,
        customerName: customer
          ? (customer.full_name ??
            ([customer.first_name, customer.last_name]
              .filter(Boolean)
              .join(' ') ||
              null))
          : dto.customerName?.trim() || null,
        customerPhone: customer?.phone ?? dto.customerPhone ?? null,
        customerAddress: customer?.address ?? dto.customerAddress ?? null,
        subtotal: formatScaledDecimal(summary.subtotal, 2),
        discountAmount: formatScaledDecimal(summary.discount, 2),
        itemDiscountAmount: formatScaledDecimal(summary.itemDiscount, 2),
        totalAmount: formatScaledDecimal(summary.total, 2),
        note: dto.note ?? null,
      });
      const savedOrder = await manager.getRepository(Order).save(order);
      await manager.getRepository(OrderItem).save(
        items.map((item) =>
          manager.getRepository(OrderItem).create({
            orderId: savedOrder.id,
            productId: item.product.id,
            stockId: item.stock.id,
            productName: item.product.name,
            productSku: item.product.sku ?? null,
            quantity: formatScaledDecimal(item.quantity, 2),
            salePrice: formatScaledDecimal(item.salePrice, 2),
            discountAmount: formatScaledDecimal(item.discount, 2),
            lineTotal: formatScaledDecimal(item.lineTotal, 2),
          }),
        ),
      );

      return this.findOneWithManager(manager, savedOrder.id);
    });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(order.orderNumber ILIKE :search OR order.customerName ILIKE :search OR order.customerPhone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: string) {
    const order = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.stock', 'stock')
      .where('order.id = :id', { id })
      .andWhere('order.deletedAt IS NULL')
      .getOne();

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      await this.assertNotInvoiced(manager, id);

      const itemRepo = manager.getRepository(OrderItem);
      const existingItems = await itemRepo.find({ where: { orderId: id } });
      let items: PreparedItem[];

      if (dto.items) {
        const oldQuantities = this.sumQuantitiesByStock(existingItems);
        const stockIds = [
          ...new Set([
            ...oldQuantities.keys(),
            ...dto.items.map((item) => item.stockId),
          ]),
        ];
        const stocks = await this.lockStocks(manager, stockIds, true);
        items = await this.prepareItems(manager, dto.items, stocks);
        const newQuantities = this.sumQuantitiesByStock(items);
        this.assertStockAvailability(stocks, newQuantities, oldQuantities);
        await this.adjustStock(manager, stocks, oldQuantities, 1n);
        await this.adjustStock(manager, stocks, newQuantities, -1n);

        await itemRepo.delete({ orderId: id });
        await itemRepo.save(
          items.map((item) =>
            itemRepo.create({
              orderId: id,
              productId: item.product.id,
              stockId: item.stock.id,
              productName: item.product.name,
              productSku: item.product.sku ?? null,
              quantity: formatScaledDecimal(item.quantity, 2),
              salePrice: formatScaledDecimal(item.salePrice, 2),
              discountAmount: formatScaledDecimal(item.discount, 2),
              lineTotal: formatScaledDecimal(item.lineTotal, 2),
            }),
          ),
        );
      } else {
        items = await this.prepareExistingItems(manager, existingItems);
      }

      const orderDiscount =
        dto.discountAmount === undefined
          ? parseScaledDecimal(order.discountAmount, 2)
          : parseScaledDecimal(dto.discountAmount, 2);
      const summary = this.calculateSummary(items, orderDiscount);

      if (dto.customerId !== undefined) {
        const customer = await this.resolveCustomer(manager, dto.customerId);
        order.customerId = customer?.id ?? null;
        order.customer = customer;
        order.customerName = customer
          ? (customer.full_name ??
            ([customer.first_name, customer.last_name]
              .filter(Boolean)
              .join(' ') ||
              null))
          : dto.customerName?.trim() || null;
        order.customerPhone = customer?.phone ?? dto.customerPhone ?? null;
        order.customerAddress =
          customer?.address ?? dto.customerAddress ?? null;
      } else {
        if (dto.customerName !== undefined) {
          order.customerName = dto.customerName?.trim() || null;
        }
        if (dto.customerPhone !== undefined) {
          order.customerPhone = dto.customerPhone ?? null;
        }
        if (dto.customerAddress !== undefined) {
          order.customerAddress = dto.customerAddress ?? null;
        }
      }

      if (dto.note !== undefined) order.note = dto.note;
      order.subtotal = formatScaledDecimal(summary.subtotal, 2);
      order.discountAmount = formatScaledDecimal(summary.discount, 2);
      order.itemDiscountAmount = formatScaledDecimal(summary.itemDiscount, 2);
      order.totalAmount = formatScaledDecimal(summary.total, 2);
      await orderRepo.save(order);

      return this.findOneWithManager(manager, id);
    });
  }

  async remove(id: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      await this.assertNotInvoiced(manager, id);

      const items = await manager.getRepository(OrderItem).find({
        where: { orderId: id },
      });
      const quantities = this.sumQuantitiesByStock(items);
      const stocks = await this.lockStocks(
        manager,
        [...quantities.keys()],
        true,
      );
      await this.adjustStock(manager, stocks, quantities, 1n);
      await manager.getRepository(Order).softDelete(id);
    });
    return { success: true };
  }

  private async findOneWithManager(manager: EntityManager, id: string) {
    const order = await manager
      .getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.stock', 'stock')
      .where('order.id = :id', { id })
      .getOne();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async resolveCustomer(
    manager: EntityManager,
    customerId?: string | null,
  ) {
    if (!customerId) return null;
    const customer = await manager.getRepository(Customer).findOne({
      where: { id: customerId, deleted_at: IsNull() },
    });
    if (!customer) throw new BadRequestException('Customer not found');
    return customer;
  }

  private async prepareItems(
    manager: EntityManager,
    requestedItems: CreateOrderItemDto[],
    lockedStocks?: Stock[],
  ): Promise<PreparedItem[]> {
    const stockIds = [...new Set(requestedItems.map((item) => item.stockId))];
    const stocks = lockedStocks ?? (await this.lockStocks(manager, stockIds));
    const products = await manager.getRepository(Product).find({
      where: {
        id: In(this.unique(requestedItems.map((item) => item.productId))),
        deletedAt: IsNull(),
        isActive: true,
      },
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const stocksById = new Map(stocks.map((stock) => [stock.id, stock]));

    return requestedItems.map((requested) => {
      const product = productsById.get(requested.productId);
      const stock = stocksById.get(requested.stockId);
      if (!product)
        throw new BadRequestException('Product not found or inactive');
      if (!stock || stock.productId !== product.id) {
        throw new BadRequestException(
          'Stock does not belong to the selected product',
        );
      }
      if (stock.deletedAt)
        throw new BadRequestException('Stock not found or inactive');

      const quantity = parseScaledDecimal(requested.quantity, 2);
      if (quantity <= 0n)
        throw new BadRequestException('Quantity must be greater than zero');
      const salePrice = parseScaledDecimal(stock.salePrice, 2);
      const discount = parseScaledDecimal(requested.discountAmount ?? '0', 2);
      const lineTotal = calculateLineTotal(salePrice, quantity, discount);
      if (discount < 0n || lineTotal < 0n) {
        throw new BadRequestException('Item discount cannot exceed its amount');
      }
      if (lineTotal > MAX_MONEY_CENTS) {
        throw new BadRequestException('Order item amount is too large');
      }

      return { product, stock, quantity, salePrice, discount, lineTotal };
    });
  }

  private async prepareExistingItems(
    manager: EntityManager,
    existingItems: OrderItem[],
  ): Promise<PreparedItem[]> {
    const stocks = await manager.getRepository(Stock).find({
      withDeleted: true,
      where: { id: In(this.unique(existingItems.map((item) => item.stockId))) },
    });
    const stocksById = new Map(stocks.map((stock) => [stock.id, stock]));
    const products = await manager.getRepository(Product).find({
      withDeleted: true,
      where: {
        id: In(this.unique(existingItems.map((item) => item.productId))),
      },
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    return existingItems.map((item) => {
      const stock = stocksById.get(item.stockId);
      const product = productsById.get(item.productId);
      if (!stock || !product) {
        throw new ConflictException(
          'Order items reference missing stock or product',
        );
      }
      const quantity = parseScaledDecimal(item.quantity, 2);
      const salePrice = parseScaledDecimal(item.salePrice, 2);
      const discount = parseScaledDecimal(item.discountAmount, 2);
      return {
        product,
        stock,
        quantity,
        salePrice,
        discount,
        lineTotal: calculateLineTotal(salePrice, quantity, discount),
      };
    });
  }

  private calculateSummary(items: PreparedItem[], orderDiscount: bigint) {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + calculateLineTotal(item.salePrice, item.quantity, 0n),
      0n,
    );
    const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0n);
    const total = subtotal - itemDiscount - orderDiscount;
    if (orderDiscount < 0n || total < 0n || subtotal > MAX_MONEY_CENTS) {
      throw new BadRequestException(
        'Order discount cannot exceed the subtotal',
      );
    }
    return {
      subtotal,
      discount: orderDiscount,
      itemDiscount,
      total,
    };
  }

  private sumQuantitiesByStock(items: PreparedItem[] | OrderItem[]) {
    const totals = new Map<string, bigint>();
    for (const item of items) {
      const stockId = this.isPreparedItem(item) ? item.stock.id : item.stockId;
      const quantity = this.isPreparedItem(item)
        ? item.quantity
        : parseScaledDecimal(item.quantity, 2);
      totals.set(stockId, (totals.get(stockId) ?? 0n) + quantity);
    }
    return totals;
  }

  private isPreparedItem(item: PreparedItem | OrderItem): item is PreparedItem {
    return typeof item.quantity === 'bigint';
  }

  private async lockStocks(
    manager: EntityManager,
    ids: string[],
    withDeleted = false,
  ) {
    if (ids.length === 0) return [];
    const query = manager
      .getRepository(Stock)
      .createQueryBuilder('stock')
      .where('stock.id IN (:...ids)', { ids })
      .orderBy('stock.id', 'ASC')
      .setLock('pessimistic_write');
    if (withDeleted) query.withDeleted();
    return query.getMany();
  }

  private assertStockAvailability(
    stocks: Stock[],
    requested: Map<string, bigint>,
    releasing = new Map<string, bigint>(),
  ) {
    const stocksById = new Map(stocks.map((stock) => [stock.id, stock]));
    for (const [stockId, quantity] of requested) {
      const stock = stocksById.get(stockId);
      if (!stock || stock.deletedAt) {
        throw new BadRequestException('Stock not found or inactive');
      }
      const available =
        parseScaledDecimal(stock.remainingQuantity, 2) +
        (releasing.get(stockId) ?? 0n);
      if (quantity > available) {
        throw new BadRequestException(
          `Insufficient stock for item ${stock.productId}`,
        );
      }
    }
  }

  private async adjustStock(
    manager: EntityManager,
    stocks: Stock[],
    quantities: Map<string, bigint>,
    direction: 1n | -1n,
  ) {
    const stocksById = new Map(stocks.map((stock) => [stock.id, stock]));
    for (const [stockId, quantity] of quantities) {
      const stock = stocksById.get(stockId);
      if (!stock) throw new ConflictException('Order stock record not found');
      const remaining =
        parseScaledDecimal(stock.remainingQuantity, 2) + quantity * direction;
      if (remaining < 0n) {
        throw new ConflictException('Stock quantity would become negative');
      }
      stock.remainingQuantity = formatScaledDecimal(remaining, 2);
    }
    if (stocks.length > 0) await manager.getRepository(Stock).save(stocks);
  }

  private async assertNotInvoiced(manager: EntityManager, orderId: string) {
    const invoice = await manager.getRepository(Invoice).findOne({
      withDeleted: true,
      where: { orderId },
    });
    if (invoice) {
      throw new ConflictException(
        'An invoiced order cannot be changed or deleted',
      );
    }
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }
}
