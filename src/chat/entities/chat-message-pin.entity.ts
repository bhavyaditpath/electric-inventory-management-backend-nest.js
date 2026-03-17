import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatRoom } from './chat-room.entity';
import { ChatMessage } from './chat-message.entity';
import { User } from '../../user/entities/user.entity';

@Entity('chat_message_pins')
@Index(['chatRoomId', 'userId', 'messageId'], { unique: true })
export class ChatMessagePin extends BaseEntityClass {
  @Column({ type: 'int' })
  chatRoomId: number;

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;

  @Column({ type: 'int' })
  messageId: number;

  @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
