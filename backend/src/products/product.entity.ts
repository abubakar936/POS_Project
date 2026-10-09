import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';

@Entity('products')
@Unique(['sku'])
@Unique(['barcode'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode?: string | null;

  @Column('uuid', { nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @Column('uuid', { nullable: true })
  subCategoryId?: string | null;

  @ManyToOne(() => SubCategory, { nullable: true })
  @JoinColumn({ name: 'subCategoryId' })
  subCategory?: SubCategory | null;

  @Column('uuid', { nullable: true })
  companyId?: string | null;

  @Column('uuid', { nullable: true })
  vendorId?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  measuringUnit?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  packSize?: string | null;

  @Column({ type: 'int', nullable: true })
  pcsPerCarton?: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  retailPrice?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salePrice?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  purchasePrice?: string | null;

  @Column({ type: 'boolean', default: false })
  isPricePrinted: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  printedPrice?: string | null;

  @Column({ type: 'boolean', default: false })
  hasVariants: boolean;


  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
