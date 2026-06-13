import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('stocks')
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  quantity: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  remainingQuantity: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  minimumQuantity?: string | null;

  @Column({ type: 'varchar', length: 50 })
  locationType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rackLocation?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  purchasePrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  salePrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  printedPrice?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalPurchaseValue?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  purchaseDate?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
