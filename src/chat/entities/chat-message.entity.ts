import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../user/entities/user.entity';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatAttachment } from './chat-attachment.entity';
import { ChatMessageDeletion } from './chat-message-deletion.entity';

@Entity('chat_messages')
export class ChatMessage extends BaseEntityClass {
  @Column({ type: 'int' })
  chatRoomId: number;

  @ManyToOne(() => ChatRoom, (room) => room.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;

  @Column({ type: 'int' })
  senderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @OneToMany(() => ChatAttachment, (attachment) => attachment.message)
  attachments: ChatAttachment[];

  @OneToMany(() => ChatMessageDeletion, (deletion) => deletion.message)
  deletions: ChatMessageDeletion[];

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
