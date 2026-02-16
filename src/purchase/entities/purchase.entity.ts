import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { User } from '../../user/entities/user.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('purchases')
export class Purchase extends BaseEntityClass {
  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50 })
  unit: string; // pieces/boxes/kgs

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  totalPrice: number;

  @Column({ type: 'int' })
  lowStockThreshold: number;

  @Column({ type: 'varchar', length: 255 })
  brand: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', nullable: true })
  branchId: number | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch | null;
}
