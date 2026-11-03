import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Invoice } from '../invoices/invoice.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index('UQ_orders_saleNumber', ['saleNumber'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({ type: 'varchar', length: 20 })
  saleNumber: string;

  @OneToOne(() => Invoice, (invoice) => invoice.order)
  invoice?: Invoice;

  @Column('uuid', { nullable: true })
  customerId?: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customerPhone?: string | null;

  @Column({ type: 'text', nullable: true })
  customerAddress?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' })
  itemDiscountAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  totalAmount: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
