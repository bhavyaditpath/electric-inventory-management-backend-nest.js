import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { BaseEntityClass } from '../../shared/base.entity';

@Entity('chat_attachments')
export class ChatAttachment extends BaseEntityClass {
  @Column({ type: 'int' })
  messageId: number;

  @ManyToOne(() => ChatMessage, (message) => message.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'int' })
  size: number;
}
