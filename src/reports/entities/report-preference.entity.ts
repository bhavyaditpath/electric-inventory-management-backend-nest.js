import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { User } from '../../user/entities/user.entity';
import { ReportType } from 'src/shared/enums/report-type.enum';
import { DeliveryMethod } from 'src/shared/enums/delivery-method.enum';

@Entity('report_preferences')
export class ReportPreference extends BaseEntityClass {
  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  reportType: ReportType;

  @Column({
    type: 'enum',
    enum: DeliveryMethod,
    default: DeliveryMethod.LOCAL_FILE,
  })
  deliveryMethod: DeliveryMethod;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}