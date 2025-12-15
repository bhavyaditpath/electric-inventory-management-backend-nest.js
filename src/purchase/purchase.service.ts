import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto/purchase.dto';
import { User } from '../user/entities/user.entity';
import { UserRole } from 'src/shared/enums/role.enum';
import { AlertService } from '../alert/alert.service';
import { Request } from '../request/entities/request.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../shared/enums/notification-type.enum';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    private alertService: AlertService,
    private notificationService: NotificationService,
  ) { }

  async findDuplicate(productName: string, userId: number) {
    return this.purchaseRepository.findOne({
      where: {
        productName,
        userId,
        isRemoved: false,
      },
    });
  }

  async create(createPurchaseDto: CreatePurchaseDto, userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const purchase = this.purchaseRepository.create({
      ...createPurchaseDto,
      userId,
      branchId: user.branchId,
      createdBy: userId,
    });

    if (user.role === UserRole.BRANCH && createPurchaseDto.adminUserId) {
      purchase.quantity = 0;
    }

    const savedPurchase = await this.purchaseRepository.save(purchase);

    if (user.branchId) {
      await this.alertService.generateAlertsForBranch(user.branchId);
    }
    // Create notification for new purchase
    await this.createPurchaseNotification(savedPurchase, user);

    return savedPurchase;
  }

  async findAll(userId?: number) {
    const query = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.user', 'user')
      .leftJoinAndSelect('purchase.branch', 'branch')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('purchase.createdAt >= NOW() - INTERVAL \'3 days\'');

    if (userId) {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (user) {
        if (user.role === UserRole.ADMIN) {
          query.andWhere('purchase.userId = :userId', { userId });
        } else if (user.role === UserRole.BRANCH) {
          query.andWhere('purchase.branchId = :branchId', {
            branchId: user.branchId,
          });
        }
      }
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, isRemoved: false },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async update(id: number, updatePurchaseDto: UpdatePurchaseDto) {
    const purchase = await this.findOne(id);

    Object.assign(purchase, updatePurchaseDto);
    const updated = await this.purchaseRepository.save(purchase);
    if (purchase.branchId) {
      await this.alertService.generateAlertsForBranch(purchase.branchId);
    }

    return updated;
  }

  async remove(id: number) {
    const purchase = await this.findOne(id);
    purchase.isRemoved = true;
    return this.purchaseRepository.save(purchase);
  }

  private async createPurchaseNotification(purchase: Purchase, user: User): Promise<void> {
    try {
      const title = 'New Purchase Added';
      const message = `${purchase.productName} (${purchase.brand}) - Quantity: ${purchase.quantity}, Price: ₹${purchase.pricePerUnit}`;

      await this.notificationService.create({
        title,
        message,
        type: NotificationType.BRANCH,
        branchId: user.branchId,
      });
    } catch (error) {
      console.error('Failed to create purchase notification:', error);
    }
  }
}
