import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../user/entities/user.entity';

@Entity('chat_room_participants')
@Index(['chatRoomId', 'userId'], { unique: true })
export class ChatRoomParticipant extends BaseEntityClass {
  @Column({ type: 'int' })
  chatRoomId: number;

  @ManyToOne(() => ChatRoom, (room) => room.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
