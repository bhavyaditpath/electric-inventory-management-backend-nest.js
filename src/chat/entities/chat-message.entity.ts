import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../user/entities/user.entity';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatAttachment } from './chat-attachment.entity';
import { ChatMessageDeletion } from './chat-message-deletion.entity';
import { ChatMessageReaction } from './chat-message-reaction.entity';
import { ChatLanguage, ChatMessageKind } from '../enums/chat-message-format.enum';

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

  @Column({ type: 'varchar', default: ChatMessageKind.TEXT })
  kind: ChatMessageKind;

  @Column({ type: 'varchar', default: ChatLanguage.PLAINTEXT })
  language: ChatLanguage;

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

  @Column({ type: 'boolean', default: false })
  isForwarded: boolean;

  @Column({ type: 'int', nullable: true })
  forwardedFromMessageId: number | null;

  @ManyToOne(() => ChatMessage, (message) => message.forwardedMessages, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'forwardedFromMessageId' })
  forwardedFromMessage: ChatMessage | null;

  @OneToMany(() => ChatMessage, (message) => message.forwardedFromMessage)
  forwardedMessages: ChatMessage[];

  @Column({ type: 'int', nullable: true })
  forwardedOriginalSenderId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  forwardedOriginalSenderName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  forwardedOriginalCreatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  forwardedOriginalContent: string | null;

  @Column({ type: 'varchar', nullable: true })
  forwardedOriginalKind: ChatMessageKind | null;

  @Column({ type: 'varchar', nullable: true })
  forwardedOriginalLanguage: ChatLanguage | null;

  @OneToMany(() => ChatAttachment, (attachment) => attachment.message)
  attachments: ChatAttachment[];

  @OneToMany(() => ChatMessageDeletion, (deletion) => deletion.message)
  deletions: ChatMessageDeletion[];

  @OneToMany(() => ChatMessageReaction, (reaction) => reaction.message)
  reactions: ChatMessageReaction[];

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'boolean', default: false })
  isDelivered: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date | null;
}
