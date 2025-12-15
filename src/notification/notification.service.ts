import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from '../shared/enums/notification-type.enum';
import { User } from '../user/entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(UserNotification)
    private userNotificationRepository: Repository<UserNotification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  async create(createDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createDto);
    const saved = await this.notificationRepository.save(notification);

    let users: User[] = [];

    if (createDto.userId) {
      users = await this.userRepository.find({ where: { id: createDto.userId } });
    }
    else if (createDto.branchId) {
      users = await this.userRepository.find({
        where: { branchId: createDto.branchId },
      });
    }

    const userNotifications = users.map(user =>
      this.userNotificationRepository.create({
        userId: user.id,
        notificationId: saved.id,
        read: false,
      }),
    );

    await this.userNotificationRepository.save(userNotifications);
    return saved;
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

  async findLatest(limit: number = 5, userId?: number): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    let data: Notification[];
    let total: number;

    if (userId) {
      // Get latest notifications for specific user
      const query = this.userNotificationRepository
        .createQueryBuilder('un')
        .innerJoinAndSelect('un.notification', 'n')
        .where('un.userId = :userId', { userId })
        .andWhere('(n.isRemoved = false OR n.isRemoved IS NULL)')
        .orderBy('n.createdAt', 'DESC')
        .take(limit);

      const result = await query.getMany();
      data = result.map(x => x.notification);
      total = result.length;
    } else {
      // Get latest notifications for all users
      [data, total] = await this.notificationRepository.findAndCount({
        where: { isRemoved: false },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }

    return { data, total, page: 1, limit };
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, isRemoved: false },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async findByUser(
    userId: number,
    page = 1,
    limit = 10,
  ) {
    const query = this.userNotificationRepository
      .createQueryBuilder('un')
      .innerJoinAndSelect('un.notification', 'n')
      .where('un.userId = :userId', { userId })
      .andWhere('(n.isRemoved = false OR n.isRemoved IS NULL)')
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data: data.map(x => ({
        ...x.notification,
        read: x.read,
      })),
      total,
      page,
      limit,
    };
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

  async getUnreadCount(userId: number) {
    const unreadCount = await this.userNotificationRepository.count({
      where: {
        userId,
        read: false,
      },
    });
    return { unreadCount };
  }

  async markAsRead(notificationId: number, userId: number) {
    const userNotification = await this.userNotificationRepository.findOne({
      where: { notificationId, userId },
    });

    if (!userNotification)
      throw new NotFoundException('Notification not found for user');

    userNotification.read = true;
    return this.userNotificationRepository.save(userNotification);
  }

  async markAllAsRead(userId: number) {
    await this.userNotificationRepository.update(
      { userId, read: false },
      { read: true },
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
