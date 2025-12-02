import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { AlertPriority } from '../../shared/enums/alert-priority.enum';
import { AlertType } from '../../shared/enums/alert-type.enum';
import { AlertStatus } from '../../shared/enums/alert-status.enum';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('alerts')
export class StockAlert extends BaseEntityClass {
  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  currentStock: number;

  @Column({ type: 'int' })
  minStock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  shortage: number;

  @Column({
    type: 'enum',
    enum: AlertPriority,
    default: AlertPriority.LOW,
  })
  priority: AlertPriority;

  @Column({
    type: 'enum',
    enum: AlertType,
  })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ type: 'timestamp', nullable: true })
  resolvedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'int' })
  branchId: number;
}
