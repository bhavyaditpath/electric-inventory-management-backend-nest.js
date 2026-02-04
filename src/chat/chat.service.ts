import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRoomParticipant } from './entities/chat-room-participant.entity';
import { User } from '../user/entities/user.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { ChatGateway } from './chat.gateway';
import { UserRole } from '../shared/enums/role.enum';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatRoomParticipant)
    private chatRoomParticipantRepository: Repository<ChatRoomParticipant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async createChatRoom(dto: CreateChatRoomDto, userId: number): Promise<ApiResponse> {
    const requester = await this.userRepository.findOne({ where: { id: userId } });
    if (!requester) {
      return ApiResponseUtil.error('User not found');
    }

    const uniqueParticipantIds = Array.from(new Set(dto.participantIds || []));
    if (!uniqueParticipantIds.includes(userId)) {
      uniqueParticipantIds.push(userId);
    }

    if (!dto.isGroupChat) {
      if (uniqueParticipantIds.length !== 2) {
        return ApiResponseUtil.error('Direct chat must have exactly 2 participants');
      }
      const otherUserId = uniqueParticipantIds.find((id) => id !== userId) as number;
      return this.getOrCreateDirectChat(userId, otherUserId);
    }

    if (uniqueParticipantIds.length < 2) {
      return ApiResponseUtil.error('Group chat must include at least 2 participants');
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueParticipantIds), isRemoved: false },
    });
    if (users.length !== uniqueParticipantIds.length) {
      return ApiResponseUtil.error('One or more users not found');
    }

    if (requester.role !== UserRole.ADMIN) {
      const differentBranch = users.some((u) => u.branchId !== requester.branchId);
      if (differentBranch) {
        return ApiResponseUtil.error('Cannot create chat with users from other branches');
      }
    }

    const room = this.chatRoomRepository.create({
      name: dto.name,
      isGroupChat: true,
      createdBy: userId,
    });

    const savedRoom = await this.chatRoomRepository.save(room);

    const participantEntities = uniqueParticipantIds.map((participantId) =>
      this.chatRoomParticipantRepository.create({
        chatRoomId: savedRoom.id,
        userId: participantId,
        createdBy: userId,
      }),
    );
    await this.chatRoomParticipantRepository.save(participantEntities);

    return ApiResponseUtil.success(savedRoom, 'Chat room created successfully');
  }

  async getUserChatRooms(userId: number): Promise<ApiResponse> {
    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'participant', 'participant.userId = :userId', {
        userId,
      })
      .leftJoinAndSelect('room.createdByUser', 'createdBy')
      .orderBy('room.updatedAt', 'DESC')
      .distinct(true)
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
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['createdByUser', 'participants', 'participants.user'],
    });

    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }

    const formattedRoom = {
      ...room,
      participants: (room.participants || []).map((p) => ({
        ...p,
        user: p.user
          ? {
              ...p.user,
              branch: p.user.branch?.name || null,
            }
          : p.user,
      })),
    };

    return ApiResponseUtil.success(formattedRoom);
  }

  async sendMessage(
    dto: SendMessageDto,
    senderId: number,
    options?: { emit?: boolean },
  ): Promise<ApiResponse> {
    const isParticipant = await this.isUserInRoom(dto.chatRoomId, senderId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

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

    if (options?.emit !== false && fullMessage) {
      this.chatGateway.sendToRoom(dto.chatRoomId, 'newMessage', fullMessage);
    }

    return ApiResponseUtil.success(fullMessage, 'Message sent successfully');
  }

  async getMessages(
    roomId: number,
    userId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<ApiResponse> {
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

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
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

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
    if (userId1 === userId2) {
      return ApiResponseUtil.error('Cannot create direct chat with yourself');
    }

    const [user1, user2] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId1, isRemoved: false } }),
      this.userRepository.findOne({ where: { id: userId2, isRemoved: false } }),
    ]);

    if (!user1 || !user2) {
      return ApiResponseUtil.error('User not found');
    }

    if (user1.role !== UserRole.ADMIN && user1.branchId !== user2.branchId) {
      return ApiResponseUtil.error('Cannot create chat with users from other branches');
    }

    const existingRoom = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('room.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('room.isGroupChat = :isGroupChat', { isGroupChat: false })
      .getOne();

    if (existingRoom) {
      return ApiResponseUtil.success(existingRoom);
    }

    // Create new direct chat
    const roomName = `${user2.username}`;

    const room = this.chatRoomRepository.create({
      name: roomName,
      isGroupChat: false,
      createdBy: userId1,
    });

    const savedRoom = await this.chatRoomRepository.save(room);

    const participantEntities = [userId1, userId2].map((participantId) =>
      this.chatRoomParticipantRepository.create({
        chatRoomId: savedRoom.id,
        userId: participantId,
        createdBy: userId1,
      }),
    );
    await this.chatRoomParticipantRepository.save(participantEntities);

    return ApiResponseUtil.success(savedRoom, 'Chat room created');
  }

  async getUsersForChat(userId: number, search?: string): Promise<ApiResponse> {
    const requester = await this.userRepository.findOne({ where: { id: userId } });
    if (!requester) {
      return ApiResponseUtil.error('User not found');
    }

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.id != :userId', { userId })
      .andWhere('user.isRemoved = :isRemoved', { isRemoved: false });

    if (requester.role !== UserRole.ADMIN) {
      query.andWhere('user.branchId = :branchId', { branchId: requester.branchId });
    }

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
        branch: u.branch?.name || null,
        role: u.role,
      })),
    );
  }

  async getUsersWithOnlineStatus(userId: number): Promise<ApiResponse> {
    const requester = await this.userRepository.findOne({ where: { id: userId } });
    if (!requester) {
      return ApiResponseUtil.error('User not found');
    }

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.id != :userId', { userId })
      .andWhere('user.isRemoved = :isRemoved', { isRemoved: false });

    if (requester.role !== UserRole.ADMIN) {
      query.andWhere('user.branchId = :branchId', { branchId: requester.branchId });
    }

    const users = await query.getMany();

    const onlineUserIds = this.chatGateway.getOnlineUsers();

    return ApiResponseUtil.success(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        branch: u.branch?.name || null,
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
        senderId: Not(userId), // Messages from others
        isRead: false,
      },
    });
  }

  async isUserInRoom(roomId: number, userId: number): Promise<boolean> {
    const count = await this.chatRoomParticipantRepository.count({
      where: { chatRoomId: roomId, userId },
    });
    return count > 0;
  }
}
