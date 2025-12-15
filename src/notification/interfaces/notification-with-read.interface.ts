import { Notification } from '../entities/notification.entity';

export interface NotificationWithRead extends Notification {
  read: boolean;
}