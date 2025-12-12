import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockAlert } from './entities/alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { DismissAlertDto } from './dto/dismiss-alert.dto';
import { AlertStatus } from '../shared/enums/alert-status.enum';
import { AlertPriority } from '../shared/enums/alert-priority.enum';
import { AlertType } from '../shared/enums/alert-type.enum';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(StockAlert)
    private alertRepository: Repository<StockAlert>,
  ) { }

  async create(createAlertDto: CreateAlertDto): Promise<StockAlert> {
    if (!createAlertDto.priority) {
      createAlertDto.priority = this.calculatePriority(
        createAlertDto.shortage,
        createAlertDto.minStock,
      );
    }

    const alert = this.alertRepository.create(createAlertDto);
    return this.alertRepository.save(alert);
  }

  async findByBranch(
    branchId: number,
    status?: AlertStatus,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: StockAlert[]; total: number; page: number; limit: number }> {
    const query = this.alertRepository
      .createQueryBuilder('alert')
      .where('alert.branchId = :branchId', { branchId })
      .andWhere('(alert.isRemoved = false OR alert.isRemoved IS NULL)');

    if (status) query.andWhere('alert.status = :status', { status });

    query.orderBy('alert.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<StockAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id, isRemoved: false },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async findExistingAnyStatusAlert(
    itemName: string,
    brand: string,
    branchId: number,
    alertType: AlertType,
  ): Promise<StockAlert | null> {
    return this.alertRepository.findOne({
      where: {
        itemName: `${itemName} (${brand})`,
        branchId,
        alertType,
        isRemoved: false,
      },
    });
  }

  async generateAlertsForBranch(branchId: number): Promise<void> {
    const inventoryQuery = this.alertRepository.manager
      .createQueryBuilder()
      .select([
        'p.productName AS productName',
        'p.brand AS brand',
        'SUM(p.quantity) AS currentStock',
        'p.lowStockThreshold AS minStock',
        'p.branchId AS branchId',
      ])
      .from('purchases', 'p')
      .where('p.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('p.branchId = :branchId', { branchId })
      .groupBy('p.productName, p.brand, p.lowStockThreshold, p.branchId');

    const inventoryData = await inventoryQuery.getRawMany();

    for (const item of inventoryData) {
      const currentStock = Number(item.currentstock);
      const minStock = Number(item.minstock);
      const productName = item.productname;
      const brand = item.brand;

      const alertType =
        currentStock <= 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK;

      // Get any existing alert regardless of status
      const existingAlert = await this.findExistingAnyStatusAlert(
        productName,
        brand,
        branchId,
        alertType,
      );

      if (
        existingAlert &&
        (existingAlert.status === AlertStatus.DISMISSED ||
          existingAlert.status === AlertStatus.RESOLVED)
      ) {
        continue;
      }

      if (currentStock <= minStock) {
        const shortage = minStock - currentStock;

        if (existingAlert) {
          if (existingAlert.status === AlertStatus.ACTIVE) {
            existingAlert.currentStock = currentStock;
            existingAlert.shortage = shortage;
            existingAlert.priority = this.calculatePriority(shortage, minStock);
            await this.alertRepository.save(existingAlert);
          }
        } else {
          await this.create({
            itemName: `${productName} (${brand})`,
            currentStock,
            minStock,
            shortage,
            alertType,
            branchId,
          });
        }
      } else {
        if (existingAlert && existingAlert.status === AlertStatus.ACTIVE) {
          existingAlert.status = AlertStatus.RESOLVED;
          existingAlert.resolvedDate = new Date();
          await this.alertRepository.save(existingAlert);
        }
      }
    }
  }

  async resolve(id: number, dto: ResolveAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedDate = new Date();
    if (dto.notes) alert.notes = dto.notes;
    return this.alertRepository.save(alert);
  }

  async dismiss(id: number, dto?: DismissAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.DISMISSED;
    if (dto?.notes) alert.notes = dto.notes;
    return this.alertRepository.save(alert);
  }

  async update(id: number, updateDto: UpdateAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);
    Object.assign(alert, updateDto);
    return this.alertRepository.save(alert);
  }

  async remove(id: number): Promise<void> {
    const alert = await this.findOne(id);
    alert.isRemoved = true;
    await this.alertRepository.save(alert);
  }

  private calculatePriority(shortage: number, minStock: number): AlertPriority {
    const percentage = shortage / minStock;
    if (percentage > 0.5) return AlertPriority.CRITICAL;
    if (percentage > 0.25) return AlertPriority.HIGH;
    if (percentage > 0.1) return AlertPriority.MEDIUM;
    return AlertPriority.LOW;
  }
  async updateProductAlert(
  itemName: string,
  brand: string,
  branchId: number,
  currentStock: number,
  minStock: number
) {
  const alertType =
    currentStock <= 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK;

  // First resolve any other active alerts for this product
  const activeAlerts = await this.alertRepository.find({
    where: {
      itemName: `${itemName} (${brand})`,
      branchId,
      status: AlertStatus.ACTIVE,
    },
  });

  for (const a of activeAlerts) {
    // If stock is healthy, resolve all active alerts
    if (currentStock > minStock) {
      a.status = AlertStatus.RESOLVED;
      a.resolvedDate = new Date();
      await this.alertRepository.save(a);
    }
  }

  // If stock is healthy, no need to create new alerts
  if (currentStock > minStock) return;

  // Check if alert of this type already exists
  const existing = await this.alertRepository.findOne({
    where: {
      itemName: `${itemName} (${brand})`,
      branchId,
      alertType,
      status: AlertStatus.ACTIVE,
    },
  });

  if (existing) {
    existing.currentStock = currentStock;
    existing.shortage = Math.max(0, minStock - currentStock);
    existing.priority = this.calculatePriority(existing.shortage, minStock);
    await this.alertRepository.save(existing);
    return;
  }

  await this.create({
    itemName: `${itemName} (${brand})`,
    currentStock,
    minStock,
    shortage: Math.max(0, minStock - currentStock),
    alertType,
    branchId,
  });
}

}
