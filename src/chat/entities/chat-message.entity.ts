import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../user/entities/user.entity';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatAttachment } from './chat-attachment.entity';
import { ChatMessageDeletion } from './chat-message-deletion.entity';
import { ChatMessageReaction } from './chat-message-reaction.entity';

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

  @Column({ type: 'int', nullable: true })
  replyToMessageId: number | null;

  @ManyToOne(() => ChatMessage, (message) => message.replies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'replyToMessageId' })
  replyToMessage: ChatMessage | null;

  @OneToMany(() => ChatMessage, (message) => message.replyToMessage)
  replies: ChatMessage[];

  @OneToMany(() => ChatAttachment, (attachment) => attachment.message)
  attachments: ChatAttachment[];

  @OneToMany(() => ChatMessageDeletion, (deletion) => deletion.message)
  deletions: ChatMessageDeletion[];

  @OneToMany(() => ChatMessageReaction, (reaction) => reaction.message)
  reactions: ChatMessageReaction[];

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
