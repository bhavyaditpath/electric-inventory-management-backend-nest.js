import { BaseEntityClass } from "../../shared/base.entity";
import { RequestStatus } from "../../shared/enums/request-status.enum";
import { Column, Entity, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Purchase } from "../../purchase/entities/purchase.entity";

@Entity("requests")
export class Request extends BaseEntityClass {
  @Column({ type: 'int' })
  requestingUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requestingUserId' })
  requestingUser: User;

  @Column({ type: 'int' })
  adminUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminUserId' })
  adminUser: User;

  @Column({ type: 'int' })
  purchaseId: number;

  @ManyToOne(() => Purchase)
  @JoinColumn({ name: 'purchaseId' })
  purchase: Purchase;

  @Column({
    type: "enum",
    enum: RequestStatus,
    default: RequestStatus.REQUEST,
  })
  status: RequestStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantityRequested: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
