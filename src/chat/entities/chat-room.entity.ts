import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntityClass } from '../../shared/base.entity';
import { User } from '../../user/entities/user.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatRoomParticipant } from './chat-room-participant.entity';
import { ChatRoomPin } from './chat-room-pin.entity';

@Entity('chat_rooms')
export class ChatRoom extends BaseEntityClass {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isGroupChat: boolean;

  // Override createdBy from BaseEntityClass to add relation
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: User | null;

  @OneToMany(() => ChatMessage, (message) => message.chatRoom)
  messages: ChatMessage[];

  @OneToMany(() => ChatRoomParticipant, (participant) => participant.chatRoom)
  participants: ChatRoomParticipant[];

  @OneToMany(() => ChatRoomPin, (pin) => pin.chatRoom)
  pins: ChatRoomPin[];
}
