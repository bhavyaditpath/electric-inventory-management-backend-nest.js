import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatAttachment } from './entities/chat-attachment.entity';
import { ChatRoomParticipant } from './entities/chat-room-participant.entity';
import { ChatRoomPin } from './entities/chat-room-pin.entity';
import { ChatMessageDeletion } from './entities/chat-message-deletion.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { User } from '../user/entities/user.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RemoveParticipantDto } from './dto/remove-participant.dto';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { UserRole } from '../shared/enums/role.enum';
import { ChatGateway } from './Gateways/chat/chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatAttachment)
    private chatAttachmentRepository: Repository<ChatAttachment>,
    @InjectRepository(ChatRoomPin)
    private chatRoomPinRepository: Repository<ChatRoomPin>,
    @InjectRepository(ChatMessageDeletion)
    private chatMessageDeletionRepository: Repository<ChatMessageDeletion>,
    @InjectRepository(ChatMessageReaction)
    private chatMessageReactionRepository: Repository<ChatMessageReaction>,
    @InjectRepository(ChatRoomParticipant)
    private chatRoomParticipantRepository: Repository<ChatRoomParticipant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) { }

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

    // if (requester.role !== UserRole.ADMIN) {
    //   const differentBranch = users.some((u) => u.branchId !== requester.branchId);
    //   if (differentBranch) {
    //     return ApiResponseUtil.error('Cannot create chat with users from other branches');
    //   }
    // }

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

    return ApiResponseUtil.success(
      this.toRoomSummary(savedRoom, userId, null, 0),
      'Chat room created successfully',
    );
  }

  async getUserChatRooms(userId: number): Promise<ApiResponse> {
    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin(
        'room.participants',
        'participant',
        'participant.userId = :userId AND participant.isRemoved = :isRemoved',
        { userId, isRemoved: false },
      )
      .leftJoinAndSelect('room.pins', 'pin', 'pin.userId = :userId', { userId })
      .leftJoinAndSelect(
        'room.participants',
        'participants',
        'participants.isRemoved = :activeOnly',
        { activeOnly: false },
      )
      .leftJoinAndSelect('participants.user', 'participantUser')
      .where('room.isRemoved = :isRemoved', { isRemoved: false })
      .select([
        'room.id',
        'room.name',
        'room.isGroupChat',
        'room.updatedAt',
        'pin.id',
        'participants.userId',
        'participantUser.id',
        'participantUser.username',
      ])
      .distinct(true)
      .getMany();

    // Get last message and unread count for each room
    const roomUpdatedAtById = new Map<number, Date | null>();
    rooms.forEach((room) => {
      roomUpdatedAtById.set(room.id, room.updatedAt ?? null);
    });

    const roomsWithMeta = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await this.getLastMessage(room.id, userId);
        const unreadCount = await this.getUnreadCount(room.id, userId);
        const pinned = !!room.pins?.length;
        return this.toRoomSummary(room, userId, lastMessage, unreadCount, pinned);
      }),
    );

    const sortedRooms = roomsWithMeta.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      const aHasMessage = !!a.lastMessage;
      const bHasMessage = !!b.lastMessage;
      if (aHasMessage !== bHasMessage) {
        return aHasMessage ? -1 : 1;
      }

      if (aHasMessage && bHasMessage) {
        const aTime = new Date(a.lastMessage!.createdAt).getTime();
        const bTime = new Date(b.lastMessage!.createdAt).getTime();
        if (aTime !== bTime) {
          return bTime - aTime;
        }
      }

      // Fallback ordering for rooms with no messages (or equal timestamps)
      const aUpdatedAt = roomUpdatedAtById.get(a.id);
      const bUpdatedAt = roomUpdatedAtById.get(b.id);
      if (aUpdatedAt && bUpdatedAt) {
        const aTime = new Date(aUpdatedAt).getTime();
        const bTime = new Date(bUpdatedAt).getTime();
        if (aTime !== bTime) {
          return bTime - aTime;
        }
      }

      return b.id - a.id;
    });

    return ApiResponseUtil.success(sortedRooms);
  }

  async getChatRoom(roomId: number, userId: number): Promise<ApiResponse> {
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
      relations: ['participants', 'participants.user', 'participants.user.branch'],
      select: {
        id: true,
        name: true,
        isGroupChat: true,
        createdBy: true,
        participants: {
          id: true,
          userId: true,
          isRemoved: true,
          user: {
            id: true,
            username: true,
            role: true,
            branch: {
              name: true,
            },
          },
        },
      },
    });

    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }

    const pinned = await this.isRoomPinned(roomId, userId);
    return ApiResponseUtil.success(this.toRoomDetails(room, userId, pinned));
  }

  // chat.service.ts (updated sendMessage)
  async sendMessage(
    dto: SendMessageDto,
    senderId: number,
    options?: { emit?: boolean },
    files?: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      filename: string;
    }>,
  ): Promise<ApiResponse> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: dto.chatRoomId, isRemoved: false },
      select: { id: true },
    });
    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }

    const isParticipant = await this.isUserInRoom(dto.chatRoomId, senderId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const trimmedContent = (dto.content ?? '').trim();
    const hasFiles = !!files && files.length > 0;

    // Teams-like behavior: text must not be whitespace-only unless files exist
    if (!trimmedContent && !hasFiles) {
      return ApiResponseUtil.error('Message must include text or at least one attachment');
    }

    const message = this.chatMessageRepository.create({
      chatRoomId: dto.chatRoomId,
      senderId,
      content: trimmedContent, // normalized content
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    if (hasFiles) {
      const attachmentEntities = files!.map((file) =>
        this.chatAttachmentRepository.create({
          messageId: savedMessage.id,
          url: `/uploads/chat/${file.filename}`,
          mimeType: file.mimetype,
          fileName: file.originalname,
          size: file.size,
        }),
      );
      await this.chatAttachmentRepository.save(attachmentEntities);
    }

    await this.chatRoomRepository.update(dto.chatRoomId, { updatedAt: new Date() });

    const fullMessage = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .select(this.getMessageSelectFields(false))
      .where('message.id = :id', { id: savedMessage.id })
      .getOne();

    const mappedMessage = fullMessage ? this.toMessageDto(fullMessage, senderId) : null;

    if (options?.emit !== false && mappedMessage) {
      this.chatGateway.sendToRoom(dto.chatRoomId, 'newMessage', mappedMessage);

      const recipients = await this.chatRoomParticipantRepository.find({
        where: { chatRoomId: dto.chatRoomId, isRemoved: false },
        select: { userId: true },
      });

      const senderName = mappedMessage.sender?.username || "Someone";

      for (const p of recipients) {
        if (p.userId === senderId) continue;

        this.chatGateway.sendToUser(p.userId, "messageNotification", {
          messageId: mappedMessage.id,
          chatRoomId: mappedMessage.chatRoomId,
          senderId,
          senderName,
          content: mappedMessage.content,
          createdAt: mappedMessage.createdAt,
        });
      }
    }

    return ApiResponseUtil.success(mappedMessage, 'Message sent successfully');
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
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .select(this.getMessageSelectFields(true))
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('deletion.id IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .distinct(true)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const mappedMessages = messages.reverse().map((m) => this.toMessageDto(m, userId));

    return ApiResponseUtil.success({
      messages: mappedMessages,
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
      .andWhere('isRemoved = :isRemoved', { isRemoved: false })
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

    // if (user1.role !== UserRole.ADMIN && user1.branchId !== user2.branchId) {
    //   return ApiResponseUtil.error('Cannot create chat with users from other branches');
    // }

    const existingRoom = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('room.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('room.isGroupChat = :isGroupChat', { isGroupChat: false })
      .andWhere('room.isRemoved = :isRemoved', { isRemoved: false })
      .getOne();

    if (existingRoom) {
      await this.chatRoomParticipantRepository.update(
        { chatRoomId: existingRoom.id, userId: In([userId1, userId2]) },
        { isRemoved: false },
      );
      const hydratedRoom = await this.chatRoomRepository.findOne({
        where: { id: existingRoom.id },
        relations: ['participants', 'participants.user'],
      });
      return ApiResponseUtil.success(this.toRoomSummary(hydratedRoom || existingRoom, userId1, null, 0));
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

    return ApiResponseUtil.success(this.toRoomSummary(savedRoom, userId1, null, 0), 'Chat room created');
  }

  async addParticipants(
    roomId: number,
    dto: AddParticipantsDto,
    requesterId: number,
  ): Promise<ApiResponse> {
    const requester = await this.userRepository.findOne({ where: { id: requesterId } });
    if (!requester) {
      return ApiResponseUtil.error('User not found');
    }

    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      select: { id: true, isGroupChat: true },
    });
    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }
    if (!room.isGroupChat) {
      return ApiResponseUtil.error('Cannot add participants to a direct chat');
    }

    if (requester.role !== UserRole.ADMIN) {
      const isParticipant = await this.isUserInRoom(roomId, requesterId);
      if (!isParticipant) {
        return ApiResponseUtil.error('Access denied');
      }
    }

    const uniqueIds = Array.from(new Set(dto.participantIds || []));
    if (uniqueIds.length === 0) {
      return ApiResponseUtil.error('No participants provided');
    }

    const existingRows = await this.chatRoomParticipantRepository
      .createQueryBuilder('p')
      .select(['p.userId AS "userId"', 'p.isRemoved AS "isRemoved"'])
      .where('p.chatRoomId = :roomId', { roomId })
      .getRawMany<{ userId: number; isRemoved: boolean }>();
    const existingActive = new Set(
      existingRows.filter((row) => !row.isRemoved).map((row) => row.userId),
    );
    const existingRemoved = new Set(
      existingRows.filter((row) => row.isRemoved).map((row) => row.userId),
    );
    const newIds = uniqueIds.filter((id) => !existingActive.has(id));
    const reAddIds = newIds.filter((id) => existingRemoved.has(id));
    const createIds = newIds.filter((id) => !existingRemoved.has(id));

    if (newIds.length === 0) {
      return ApiResponseUtil.success(null, 'No new participants to add');
    }

    const users = await this.userRepository.find({
      where: { id: In(newIds), isRemoved: false },
    });
    if (users.length !== newIds.length) {
      return ApiResponseUtil.error('One or more users not found');
    }

    if (requester.role !== UserRole.ADMIN) {
      const differentBranch = users.some((u) => u.branchId !== requester.branchId);
      if (differentBranch) {
        return ApiResponseUtil.error('Cannot add users from other branches');
      }
    }

    if (reAddIds.length > 0) {
      await this.chatRoomParticipantRepository.update(
        { chatRoomId: roomId, userId: In(reAddIds) },
        { isRemoved: false, updatedBy: requesterId },
      );
    }

    if (createIds.length > 0) {
      const participantEntities = createIds.map((participantId) =>
        this.chatRoomParticipantRepository.create({
          chatRoomId: roomId,
          userId: participantId,
          createdBy: requesterId,
        }),
      );
      await this.chatRoomParticipantRepository.save(participantEntities);
    }

    const updatedRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['participants', 'participants.user', 'participants.user.branch'],
      select: {
        id: true,
        name: true,
        isGroupChat: true,
        createdBy: true,
        participants: {
          id: true,
          userId: true,
          isRemoved: true,
          user: {
            id: true,
            username: true,
            role: true,
            branch: {
              name: true,
            },
          },
        },
      },
    });

    return ApiResponseUtil.success(
      updatedRoom ? this.toRoomDetails(updatedRoom, requesterId) : null,
      'Participants added',
    );
  }

  async removeParticipant(
    roomId: number,
    requesterId: number,
    dto: RemoveParticipantDto,
  ): Promise<ApiResponse> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
      select: { id: true, isGroupChat: true, createdBy: true },
    });
    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }
    if (!room.isGroupChat) {
      return ApiResponseUtil.error('Cannot remove participants from a direct chat');
    }

    const requesterIsParticipant = await this.isUserInRoom(roomId, requesterId);
    if (!requesterIsParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const targetUserId = dto.userId ?? requesterId;
    const removingSelf = targetUserId === requesterId;

    if (!removingSelf && room.createdBy !== requesterId) {
      return ApiResponseUtil.error('Only group admin can remove other participants');
    }
    const activeCount = await this.chatRoomParticipantRepository.count({
      where: { chatRoomId: roomId, isRemoved: false },
    });
    if (activeCount <= 1) {
      return ApiResponseUtil.error('Cannot leave the group as the only member');
    }

    if (removingSelf && room.createdBy === requesterId) {
      if (!dto.newAdminId) {
        return ApiResponseUtil.error('Admin must transfer admin role before leaving');
      }
      if (dto.newAdminId === requesterId) {
        return ApiResponseUtil.error('New admin must be a different user');
      }

      const newAdminIsParticipant = await this.chatRoomParticipantRepository.count({
        where: { chatRoomId: roomId, userId: dto.newAdminId, isRemoved: false },
      });
      if (!newAdminIsParticipant) {
        return ApiResponseUtil.error('New admin must be an active participant');
      }

      await this.chatRoomRepository.update(roomId, {
        createdBy: dto.newAdminId,
        updatedBy: requesterId,
      });
    }

    const targetParticipant = await this.chatRoomParticipantRepository.findOne({
      where: { chatRoomId: roomId, userId: targetUserId },
      select: { id: true, isRemoved: true },
    });
    if (!targetParticipant) {
      return ApiResponseUtil.error('Participant not found');
    }

    if (targetParticipant.isRemoved) {
      return ApiResponseUtil.success(null, 'Participant already removed');
    }

    await this.chatRoomParticipantRepository.update(
      { chatRoomId: roomId, userId: targetUserId },
      { isRemoved: true, updatedBy: requesterId },
    );

    return ApiResponseUtil.success(null, 'Participant removed');
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
      query.andWhere('(user.branchId = :branchId OR user.role = :adminRole)', {
        branchId: requester.branchId,
        adminRole: UserRole.ADMIN,
      });
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
      query.andWhere('(user.branchId = :branchId OR user.role = :adminRole)', {
        branchId: requester.branchId,
        adminRole: UserRole.ADMIN,
      });
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

  private async getLastMessage(roomId: number, userId: number): Promise<ChatMessage | null> {
    return this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .select(this.getMessageSelectFields(true))
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('deletion.id IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .getOne();
  }

  private getMessageSelectFields(includeIsRemoved: boolean): string[] {
    const fields = [
      'message.id',
      'message.chatRoomId',
      'message.senderId',
      'message.content',
      'message.createdAt',
      'sender.username',
      'attachments.id',
      'attachments.messageId',
      'attachments.url',
      'attachments.mimeType',
      'attachments.fileName',
      'attachments.size',
      'reactions.id',
      'reactions.userId',
      'reactions.emoji',
    ];

    if (includeIsRemoved) {
      fields.push('message.isRemoved');
    }

    return fields;
  }

  private async getUnreadCount(roomId: number, userId: number): Promise<number> {
    return this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.isRead = :isRead', { isRead: false })
      .andWhere('deletion.id IS NULL')
      .getCount();
  }

  private formatRoomForUser(room: ChatRoom, userId: number) {
    if (!room || room.isGroupChat) {
      return room;
    }

    const otherParticipant = room.participants?.find((p) => p.userId !== userId);
    const displayName = otherParticipant?.user?.username || room.name;

    return { ...room, name: displayName };
  }

  private toMessageDto(message: ChatMessage, currentUserId?: number) {
    const reactionsMap = new Map<string, Set<number>>();
    for (const reaction of message.reactions || []) {
      const users = reactionsMap.get(reaction.emoji) || new Set<number>();
      users.add(reaction.userId);
      reactionsMap.set(reaction.emoji, users);
    }

    return {
      id: message.id,
      chatRoomId: message.chatRoomId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      isRemoved: message.isRemoved,
      attachments: (message.attachments || []).map((a) => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType,
        fileName: a.fileName,
        size: a.size,
      })),
      reactions: Array.from(reactionsMap.entries()).map(([emoji, userIds]) => ({
        emoji,
        count: userIds.size,
        reactedByMe: currentUserId ? userIds.has(currentUserId) : false,
        userIds: Array.from(userIds),
      })),
      sender: message.sender
        ? {
          username: message.sender.username,
        }
        : undefined,
    };
  }

  private toRoomSummary(
    room: ChatRoom,
    userId: number,
    lastMessage?: ChatMessage | null,
    unreadCount: number = 0,
    pinned: boolean = false,
  ) {
    const formattedRoom = this.formatRoomForUser(room, userId);

    return {
      id: formattedRoom.id,
      name: formattedRoom.name,
      isGroupChat: formattedRoom.isGroupChat,
      lastMessage: lastMessage ? this.toMessageDto(lastMessage, userId) : null,
      unreadCount,
      pinned,
    };
  }

  private toRoomDetails(room: ChatRoom, userId: number, pinned: boolean = false) {
    const formattedRoom = this.formatRoomForUser(room, userId);

    return {
      id: formattedRoom.id,
      name: formattedRoom.name,
      isGroupChat: formattedRoom.isGroupChat,
      createdBy: room.createdBy,
      pinned,
      participants: (room.participants || [])
        .filter((p) => !p.isRemoved)
        .map((p) => ({
          userId: p.userId,
          isRemoved: p.isRemoved,
          user: p.user
            ? {
              id: p.user.id,
              username: p.user.username,
              branch: p.user.branch?.name || null,
              role: p.user.role,
            }
            : undefined,
        })),
    };
  }

  async isUserInRoom(roomId: number, userId: number): Promise<boolean> {
    const count = await this.chatRoomParticipantRepository.count({
      where: { chatRoomId: roomId, userId, isRemoved: false },
    });
    return count > 0;
  }

  async deleteChatRoom(roomId: number, userId: number): Promise<ApiResponse> {
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    await this.chatRoomParticipantRepository.update(
      { chatRoomId: roomId, userId },
      { isRemoved: true, updatedBy: userId },
    );

    return ApiResponseUtil.success(null, 'Chat room removed for you');
  }

  async toggleMessageReaction(messageId: number, userId: number, emoji: string): Promise<ApiResponse> {
    const normalizedEmoji = (emoji || '').trim();
    if (!normalizedEmoji) return ApiResponseUtil.error('Emoji is required');

    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, isRemoved: false },
      select: { id: true, chatRoomId: true, senderId: true }, // add senderId
    });
    if (!message) return ApiResponseUtil.error('Message not found');

    const isParticipant = await this.isUserInRoom(message.chatRoomId, userId);
    if (!isParticipant) return ApiResponseUtil.error('Access denied');

    const existingReaction = await this.chatMessageReactionRepository.findOne({
      where: { messageId, userId, emoji: normalizedEmoji },
      select: { id: true },
    });

    let reacted = false;
    if (existingReaction) {
      await this.chatMessageReactionRepository.delete({ id: existingReaction.id });
    } else {
      await this.chatMessageReactionRepository.save(
        this.chatMessageReactionRepository.create({
          messageId,
          userId,
          emoji: normalizedEmoji,
          createdBy: userId,
        }),
      );
      reacted = true;
    }

    const updatedMessage = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .select(this.getMessageSelectFields(true))
      .where('message.id = :messageId', { messageId })
      .andWhere('message.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('deletion.id IS NULL')
      .getOne();

    const mappedMessage = updatedMessage ? this.toMessageDto(updatedMessage, userId) : null;

    if (mappedMessage) {
      this.chatGateway.sendToRoom(message.chatRoomId, 'messageReactionUpdated', mappedMessage);

      if (message.senderId !== userId && reacted) {
        const reactor = await this.userRepository.findOne({
          where: { id: userId },
          select: { id: true, username: true },
        });

        this.chatGateway.sendToUser(message.senderId, 'reactionNotification', {
          messageId: message.id,
          chatRoomId: message.chatRoomId,
          emoji: normalizedEmoji,
          reactorId: userId,
          reactorName: reactor?.username ?? 'Someone',
          action: 'added',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return ApiResponseUtil.success(mappedMessage, reacted ? 'Reaction added' : 'Reaction removed');
  }

  async deleteMessage(messageId: number, userId: number): Promise<ApiResponse> {
    const requester = await this.userRepository.findOne({ where: { id: userId } });
    if (!requester) {
      return ApiResponseUtil.error('User not found');
    }

    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, isRemoved: false },
      select: { id: true, senderId: true, chatRoomId: true },
    });
    if (!message) {
      return ApiResponseUtil.error('Message not found');
    }

    const isParticipant = await this.isUserInRoom(message.chatRoomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const canDelete =
      requester.role === UserRole.ADMIN || message.senderId === userId;
    if (!canDelete) {
      return ApiResponseUtil.error('Access denied');
    }

    const existingDeletion = await this.chatMessageDeletionRepository.findOne({
      where: { messageId, userId },
      select: { id: true },
    });

    if (!existingDeletion) {
      const deletion = this.chatMessageDeletionRepository.create({ messageId, userId });
      await this.chatMessageDeletionRepository.save(deletion);
    }

    return ApiResponseUtil.success(null, 'Message deleted');
  }

  async setRoomPinned(roomId: number, userId: number, pinned: boolean): Promise<ApiResponse> {
    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
      select: { id: true },
    });
    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }

    const existing = await this.chatRoomPinRepository.findOne({
      where: { chatRoomId: roomId, userId },
    });

    if (pinned) {
      if (!existing) {
        const pin = this.chatRoomPinRepository.create({ chatRoomId: roomId, userId });
        await this.chatRoomPinRepository.save(pin);
      }
    } else if (existing) {
      await this.chatRoomPinRepository.delete({ chatRoomId: roomId, userId });
    }

    return ApiResponseUtil.success({ pinned }, 'Pin updated');
  }

  async getAttachmentForDownload(
    attachmentId: number,
    userId: number,
  ): Promise<ChatAttachment | null> {
    return this.chatAttachmentRepository
      .createQueryBuilder('attachment')
      .leftJoin('attachment.message', 'message')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .leftJoin('message.chatRoom', 'room')
      .leftJoin(
        'room.participants',
        'participant',
        'participant.userId = :userId AND participant.isRemoved = :isRemoved',
        { userId, isRemoved: false },
      )
      .select([
        'attachment.id',
        'attachment.url',
        'attachment.mimeType',
        'attachment.fileName',
        'attachment.size',
        'message.id',
        'message.isRemoved',
        'room.id',
        'room.isRemoved',
        'participant.id',
      ])
      .where('attachment.id = :attachmentId', { attachmentId })
      .andWhere('message.isRemoved = :messageRemoved', { messageRemoved: false })
      .andWhere('deletion.id IS NULL')
      .andWhere('room.isRemoved = :roomRemoved', { roomRemoved: false })
      .andWhere('participant.id IS NOT NULL')
      .getOne();
  }

  private async isRoomPinned(roomId: number, userId: number): Promise<boolean> {
    const pin = await this.chatRoomPinRepository.findOne({
      where: { chatRoomId: roomId, userId },
      select: { id: true },
    });
    return !!pin;
  }
}
