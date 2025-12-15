import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationType } from '../shared/enums/notification-type.enum';
import { ApiResponseUtil } from '../shared/api-response';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    try {
      const result = await this.notificationService.create(createNotificationDto);
      return ApiResponseUtil.success(result, 'Notification created successfully');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to create notification');
    }
  }

  @Get('latest')
  async getLatest(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? +limit : 5;
      const result = await this.notificationService.findLatest(limitNum);
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to fetch latest notifications');
    }
  }

  @Get()
  async findAll(
    @Query('type') type?: NotificationType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? +page : 1;
      const limitNum = limit ? +limit : 10;
      const result = await this.notificationService.findAll(type, pageNum, limitNum);
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to fetch notifications');
    }
  }

  @Get('unread-count')
  async getUnreadCount() {
    try {
      const result = await this.notificationService.getUnreadCount();
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to fetch unread count');
    }
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? +page : 1;
      const limitNum = limit ? +limit : 10;
      const result = await this.notificationService.findByUser(+userId, pageNum, limitNum);
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to fetch user notifications');
    }
  }

  @Get('branch/:branchId')
  async findByBranch(
    @Param('branchId') branchId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? +page : 1;
      const limitNum = limit ? +limit : 10;
      const result = await this.notificationService.findByBranch(+branchId, pageNum, limitNum);
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to fetch branch notifications');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.notificationService.findOne(+id);
      return ApiResponseUtil.success(result);
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Notification not found');
    }
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    try {
      const result = await this.notificationService.markAsRead(+id);
      return ApiResponseUtil.success(result, 'Notification marked as read');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to mark notification as read');
    }
  }

  @Patch('mark-all-read')
  async markAllAsRead() {
    try {
      const result = await this.notificationService.markAllAsRead();
      return ApiResponseUtil.success(result, 'All notifications marked as read');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to mark all notifications as read');
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateNotificationDto: UpdateNotificationDto) {
    try {
      const result = await this.notificationService.update(+id, updateNotificationDto);
      return ApiResponseUtil.success(result, 'Notification updated successfully');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to update notification');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.notificationService.remove(+id);
      return ApiResponseUtil.success(null, 'Notification deleted successfully');
    } catch (error) {
      return ApiResponseUtil.error(error.message || 'Failed to delete notification');
    }
  }
}