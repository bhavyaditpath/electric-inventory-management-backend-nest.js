import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatMessage } from './chat-message.entity';
import { User } from '../../user/entities/user.entity';
import { MessageReceiptStatus } from '../enums/chat-message-receipt-status';

@Entity('chat_message_receipts')
@Index(['messageId', 'userId'], { unique: true })
export class ChatMessageReceipt extends BaseEntityClass {
  @Column({ type: 'int' })
  messageId: number;

  @ManyToOne(() => ChatMessage, (message) => message.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: MessageReceiptStatus,
    default: MessageReceiptStatus.SENT,
  })
  status: MessageReceiptStatus;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}