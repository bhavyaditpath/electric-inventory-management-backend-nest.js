import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatMessage } from './chat-message.entity';
import { User } from '../../user/entities/user.entity';

@Entity('chat_message_reactions')
@Index(['messageId', 'userId', 'emoji'], { unique: true })
export class ChatMessageReaction extends BaseEntityClass {
  @Column({ type: 'int' })
  messageId: number;

  @ManyToOne(() => ChatMessage, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 32 })
  emoji: string;
}
