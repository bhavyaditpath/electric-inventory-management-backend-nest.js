import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto/purchase.dto';
import { User } from '../user/entities/user.entity';
import { UserRole } from 'src/shared/enums/role.enum';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

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
    // Get user to determine branch
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create purchase record
    const purchase = this.purchaseRepository.create({
      ...createPurchaseDto,
      userId,
      branchId: user.branchId,
      createdBy: userId,
    });

    return this.purchaseRepository.save(purchase);
  }

  async findAll(userId?: number) {
    const query = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.user', 'user')
      .leftJoinAndSelect('purchase.branch', 'branch')
      .where('purchase.isRemoved = :isRemoved', { isRemoved: false });

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
      relations: ['user', 'branch'],
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async update(id: number, updatePurchaseDto: UpdatePurchaseDto) {
    const purchase = await this.findOne(id);
    Object.assign(purchase, updatePurchaseDto);
    return this.purchaseRepository.save(purchase);
  }

  async remove(id: number) {
    const purchase = await this.findOne(id);
    purchase.isRemoved = true;
    return this.purchaseRepository.save(purchase);
  }
}
