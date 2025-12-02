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
    // Calculate priority if not provided
    if (!createAlertDto.priority) {
      createAlertDto.priority = this.calculatePriority(createAlertDto.shortage, createAlertDto.minStock);
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
      .where('alert."branchId" = :branchId', { branchId })
      .andWhere('(alert.isRemoved = false OR alert.isRemoved IS NULL)');

    if (status) {
      query.andWhere('alert.status = :status', { status });
    }

    query
      .orderBy('alert.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<StockAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id, isRemoved: false },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async resolve(id: number, resolveAlertDto: ResolveAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedDate = new Date();
    if (resolveAlertDto.notes) {
      alert.notes = resolveAlertDto.notes;
    }

    return this.alertRepository.save(alert);
  }

  async dismiss(id: number, dismissAlertDto?: DismissAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);

    alert.status = AlertStatus.DISMISSED;
    if (dismissAlertDto?.notes) {
      alert.notes = dismissAlertDto.notes;
    }

    return this.alertRepository.save(alert);
  }

  async update(id: number, updateAlertDto: UpdateAlertDto): Promise<StockAlert> {
    const alert = await this.findOne(id);
    Object.assign(alert, updateAlertDto);
    return this.alertRepository.save(alert);
  }

  async remove(id: number): Promise<void> {
    const alert = await this.findOne(id);
    alert.isRemoved = true;
    await this.alertRepository.save(alert);
  }

  private calculatePriority(shortage: number, minStock: number): AlertPriority {
    const shortagePercentage = shortage / minStock;

    if (shortagePercentage > 0.5) {
      return AlertPriority.CRITICAL;
    } else if (shortagePercentage > 0.25) {
      return AlertPriority.HIGH;
    } else if (shortagePercentage > 0.1) {
      return AlertPriority.MEDIUM;
    } else {
      return AlertPriority.LOW;
    }
  }

  async findExistingAlert(
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
        status: AlertStatus.ACTIVE,
        isRemoved: false,
      },
    });
  }

  // Method to generate alerts based on inventory levels
  async generateAlertsForBranch(branchId: number): Promise<void> {
    // Get inventory data for the branch
    // This would typically call inventory service, but for now we'll query purchases directly
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
      const minStock = item.minstock;

      if (currentStock <= minStock) {
        const shortage = minStock - currentStock;
        const alertType = currentStock <= 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK;

        // Check if alert already exists
        const existingAlert = await this.findExistingAlert(
          item.productname,
          item.brand,
          branchId,
          alertType,
        );

        if (existingAlert) {
          // Update existing alert with new values
          existingAlert.currentStock = currentStock;
          existingAlert.shortage = shortage;
          existingAlert.priority = this.calculatePriority(shortage, minStock);
          await this.alertRepository.save(existingAlert);
        } else {
          // Create new alert
          await this.create({
            itemName: `${item.productname} (${item.brand})`,
            currentStock,
            minStock,
            shortage,
            alertType,
            branchId,
          });
        }
      } else {
        // If stock is now above threshold, resolve any existing alerts
        const existingAlert = await this.findExistingAlert(
          item.productname,
          item.brand,
          branchId,
          AlertType.LOW_STOCK,
        );
        if (existingAlert && existingAlert.status === AlertStatus.ACTIVE) {
          existingAlert.status = AlertStatus.RESOLVED;
          existingAlert.resolvedDate = new Date();
          await this.alertRepository.save(existingAlert);
        }

        const existingOutOfStockAlert = await this.findExistingAlert(
          item.productname,
          item.brand,
          branchId,
          AlertType.OUT_OF_STOCK,
        );
        if (existingOutOfStockAlert && existingOutOfStockAlert.status === AlertStatus.ACTIVE) {
          existingOutOfStockAlert.status = AlertStatus.RESOLVED;
          existingOutOfStockAlert.resolvedDate = new Date();
          await this.alertRepository.save(existingOutOfStockAlert);
        }
      }
    }
  }
}
