import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { User } from '../../user/entities/user.entity';
import { Notification } from './notification.entity';

@Entity('user_notifications')
@Unique(['userId', 'notificationId'])
export class UserNotification extends BaseEntityClass {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => Notification)
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column({ type: 'int' })
  notificationId: number;

  @Column({ type: 'boolean', default: false })
  read: boolean;
}