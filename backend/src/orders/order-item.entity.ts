import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('uuid', { nullable: true })
  stockId?: string | null;

  @ManyToOne(() => Stock, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stockId' })
  stock?: Stock | null;

  @Column({ type: 'boolean', default: false })
  soldUnavailable: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  purchasePrice?: string | null;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  productSku?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  quantity: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  salePrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0' })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal: string;
}
