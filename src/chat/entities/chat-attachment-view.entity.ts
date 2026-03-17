import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ChatAttachment } from './chat-attachment.entity';
import { User } from '../../user/entities/user.entity';
import { BaseEntityClass } from '../../shared/base.entity';

@Entity('chat_attachment_views')
@Unique(['attachmentId', 'userId'])
export class ChatAttachmentView extends BaseEntityClass {
  @Column({ type: 'int' })
  attachmentId: number;

  @ManyToOne(() => ChatAttachment, (attachment) => attachment.views, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attachmentId' })
  attachment: ChatAttachment;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  viewedAt: Date;
}
