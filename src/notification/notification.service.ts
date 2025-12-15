import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from '../shared/enums/notification-type.enum';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createNotificationDto);
    return this.notificationRepository.save(notification);
  }

  async findAll(type?: NotificationType, page: number = 1, limit: number = 10): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('(notification.isRemoved = false OR notification.isRemoved IS NULL)');

    if (type) {
      query.andWhere('notification.type = :type', { type });
    }

    query.orderBy('notification.createdAt', 'DESC')
         .skip((page - 1) * limit)
         .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async findLatest(limit: number = 5): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.notificationRepository.findAndCount({
      where: { isRemoved: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { data, total, page: 1, limit };
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, isRemoved: false },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async findByUser(userId: number, page: number = 1, limit: number = 10): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('(notification.isRemoved = false OR notification.isRemoved IS NULL)');

    query.orderBy('notification.createdAt', 'DESC')
         .skip((page - 1) * limit)
         .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async findByBranch(branchId: number, page: number = 1, limit: number = 10): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.branchId = :branchId', { branchId })
      .andWhere('(notification.isRemoved = false OR notification.isRemoved IS NULL)');

    query.orderBy('notification.createdAt', 'DESC')
         .skip((page - 1) * limit)
         .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationRepository.count({
      where: { read: false, isRemoved: false },
    });
    return { unreadCount };
  }

  async markAsRead(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    notification.read = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(): Promise<{ success: boolean }> {
    await this.notificationRepository.update(
      { read: false, isRemoved: false },
      { read: true }
    );
    return { success: true };
  }

  async update(id: number, updateNotificationDto: UpdateNotificationDto): Promise<Notification> {
    const notification = await this.findOne(id);
    Object.assign(notification, updateNotificationDto);
    return this.notificationRepository.save(notification);
  }

  async remove(id: number): Promise<void> {
    const notification = await this.findOne(id);
    notification.isRemoved = true;
    await this.notificationRepository.save(notification);
  }
}