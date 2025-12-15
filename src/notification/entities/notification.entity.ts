import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { NotificationType } from '../../shared/enums/notification-type.enum';
import { User } from '../../user/entities/user.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('notifications')
export class Notification extends BaseEntityClass {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'int', nullable: true })
  branchId: number | null;
}