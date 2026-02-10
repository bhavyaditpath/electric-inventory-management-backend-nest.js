import { Entity, Column } from 'typeorm';
import { BaseEntityClass } from 'src/shared/base.entity';
import { CallLogsStatus } from 'src/shared/enums/callLogsStatus.enum';

@Entity('call_logs')
export class CallLog extends BaseEntityClass {

  @Column({ type: 'int' })
  roomId: number;

  @Column({ type: 'int' })
  callerId: number;

  @Column({ type: 'int' })
  receiverId: number;

  @Column({
    type: 'enum',
    enum: CallLogsStatus,
    default: CallLogsStatus.MISSED,
  })
  status: CallLogsStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null; // seconds
}
