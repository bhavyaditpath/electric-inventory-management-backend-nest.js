import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../user/entities/user.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async createChatRoom(dto: CreateChatRoomDto, userId: number): Promise<ApiResponse> {
    const room = this.chatRoomRepository.create({
      name: dto.name,
      isGroupChat: dto.isGroupChat || false,
      createdBy: userId,
    });

    const savedRoom = await this.chatRoomRepository.save(room);
    return ApiResponseUtil.success(savedRoom, 'Chat room created successfully');
  }

  async getUserChatRooms(userId: number): Promise<ApiResponse> {
    // Get all rooms where user has sent or received messages
    const messages = await this.chatMessageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chatRoom', 'room')
      .where('message.senderId = :userId', { userId })
      .orWhere((qb) => {
        qb.innerJoin('room.messages', 'm', 'm.senderId != :userId', { userId });
      })
      .getMany();

    const roomIds = [...new Set(messages.map((m) => m.chatRoomId))];

    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.createdByUser', 'createdBy')
      .where('room.id IN (:...roomIds)', { roomIds })
      .orderBy('room.updatedAt', 'DESC')
      .getMany();

    // Get last message and unread count for each room
    const roomsWithMeta = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await this.getLastMessage(room.id);
        const unreadCount = await this.getUnreadCount(room.id, userId);
        return {
          ...room,
          lastMessage,
          unreadCount,
        };
      }),
    );

    return ApiResponseUtil.success(roomsWithMeta);
  }

  async getChatRoom(roomId: number, userId: number): Promise<ApiResponse> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['createdBy'],
    });

    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }

    return ApiResponseUtil.success(room);
  }

  async sendMessage(dto: SendMessageDto, senderId: number): Promise<ApiResponse> {
    const message = this.chatMessageRepository.create({
      chatRoomId: dto.chatRoomId,
      senderId,
      content: dto.content,
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    // Update room's updatedAt
    await this.chatRoomRepository.update(dto.chatRoomId, { updatedAt: new Date() });

    // Fetch full message with sender
    const fullMessage = await this.chatMessageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
    });

    return ApiResponseUtil.success(fullMessage, 'Message sent successfully');
  }

  async getMessages(
    roomId: number,
    userId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<ApiResponse> {
    const [messages, total] = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatRoomId = :roomId', { roomId })
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return ApiResponseUtil.success({
      messages: messages.reverse(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async markMessagesAsRead(roomId: number, userId: number): Promise<ApiResponse> {
    await this.chatMessageRepository
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ isRead: true, readAt: new Date() })
      .where('chatRoomId = :roomId', { roomId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    return ApiResponseUtil.success(null, 'Messages marked as read');
  }

  async getOrCreateDirectChat(userId1: number, userId2: number): Promise<ApiResponse> {
    // Check if direct chat already exists between these users
    const existingRoom = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.messages', 'message')
      .where('message.senderId = :userId1', { userId1 })
      .orWhere('message.senderId = :userId2', { userId2 })
      .andWhere('room.isGroupChat = :isGroupChat', { isGroupChat: false })
      .getOne();

    if (existingRoom) {
      return ApiResponseUtil.success(existingRoom);
    }

    // Create new direct chat
    const user2 = await this.userRepository.findOne({ where: { id: userId2 } });
    const roomName = `Chat with ${user2?.username || 'User'}`;

    const room = this.chatRoomRepository.create({
      name: roomName,
      isGroupChat: false,
      createdBy: userId1,
    });

    const savedRoom = await this.chatRoomRepository.save(room);
    return ApiResponseUtil.success(savedRoom, 'Chat room created');
  }

  async getUsersForChat(userId: number, search?: string): Promise<ApiResponse> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.id != :userId', { userId })
      .andWhere('user.isRemoved = :isRemoved', { isRemoved: false });

    if (search) {
      query.andWhere('LOWER(user.username) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    const users = await query.getMany();

    return ApiResponseUtil.success(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        branch: u.branch?.name,
        role: u.role,
      })),
    );
  }

  async getUsersWithOnlineStatus(userId: number): Promise<ApiResponse> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.id != :userId', { userId })
      .andWhere('user.isRemoved = :isRemoved', { isRemoved: false });

    const users = await query.getMany();

    const onlineUserIds = this.chatGateway.getOnlineUsers();

    return ApiResponseUtil.success(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        branch: u.branch?.name,
        role: u.role,
        isOnline: onlineUserIds.includes(u.id),
      })),
    );
  }

  private async getLastMessage(roomId: number): Promise<ChatMessage | null> {
    return this.chatMessageRepository.findOne({
      where: { chatRoomId: roomId },
      order: { createdAt: 'DESC' },
      relations: ['sender'],
    });
  }

  private async getUnreadCount(roomId: number, userId: number): Promise<number> {
    return this.chatMessageRepository.count({
      where: {
        chatRoomId: roomId,
        senderId: userId, // Messages from others
        isRead: false,
      },
    });
  }
}
