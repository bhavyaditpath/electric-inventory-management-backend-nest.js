import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatMessage } from './chat-message.entity';
import { User } from '../../user/entities/user.entity';

@Entity('chat_message_deletions')
@Index(['messageId', 'userId'], { unique: true })
export class ChatMessageDeletion extends BaseEntityClass {
  @Column({ type: 'int' })
  messageId: number;

  @ManyToOne(() => ChatMessage, (message) => message.deletions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
