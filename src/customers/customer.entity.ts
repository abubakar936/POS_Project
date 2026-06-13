import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customer_code?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  full_name?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alternate_phone?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_type?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' })
  opening_balance: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0' })
  current_balance: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column('uuid', { nullable: true })
  created_by?: string | null;

  @Column('uuid', { nullable: true })
  updated_by?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at?: Date | null;
}
