import { Entity, Column } from 'typeorm';
import { BaseEntityClass } from 'src/shared/base.entity';
import { CallLogsStatus } from 'src/shared/enums/callLogsStatus.enum';
import { CallType } from 'src/shared/enums/callType.enum';

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

  @Column({
    type: 'enum',
    enum: CallType,
    default: CallType.AUDIO,
  })
  callType: CallType;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null; // seconds

  @Column({ type: 'varchar', length: 500, nullable: true })
  recordingPath?: string | null;

  @Column({ type: 'boolean', default: false })
  recordingProcessing: boolean;

  @Column({ type: 'int', default: 0 })
  recordingChunks: number;

}
