import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
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
import { ForwardMessageDto } from './dto/forward-message.dto';
import { RemoveParticipantDto } from './dto/remove-participant.dto';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { UserRole } from '../shared/enums/role.enum';
import { ChatGateway } from './Gateways/chat/chat.gateway';
import { MessageNotificationPayload } from './types/message-notification.type';

@Injectable()
export class ChatService {
  private static readonly MAX_FORWARD_TARGETS = 20;

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

    let replyToMessageId: number | null = null;
    if (dto.replyToMessageId !== undefined && dto.replyToMessageId !== null) {
      const replyMessage = await this.chatMessageRepository
        .createQueryBuilder('message')
        .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', {
          userId: senderId,
        })
        .select(['message.id', 'message.chatRoomId'])
        .where('message.id = :replyToMessageId', { replyToMessageId: dto.replyToMessageId })
        .andWhere('message.isRemoved = :isRemoved', { isRemoved: false })
        .andWhere('deletion.id IS NULL')
        .getOne();

      if (!replyMessage) {
        return ApiResponseUtil.error('Reply message not found');
      }

      if (replyMessage.chatRoomId !== dto.chatRoomId) {
        return ApiResponseUtil.error('Reply message must belong to the same room');
      }

      replyToMessageId = replyMessage.id;
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
      replyToMessageId,
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

    const mappedMessage = await this.getMappedMessageById(savedMessage.id, senderId, {
      includeIsRemoved: false,
      excludeDeletedForUser: false,
    });

    if (options?.emit !== false && mappedMessage) {
      this.chatGateway.sendToRoom(dto.chatRoomId, 'newMessage', mappedMessage);
      await this.emitMessageNotificationToRecipients(dto.chatRoomId, senderId, mappedMessage);
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

    const [messages, total] = await this.createMessageDetailsQuery({
      includeIsRemoved: true,
      currentUserId: userId,
      excludeDeletedForUser: true,
    })
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

  async forwardMessage(dto: ForwardMessageDto, userId: number): Promise<ApiResponse> {
    const uniqueTargetRoomIds = Array.from(new Set(dto.targetRoomIds || []));
    if (uniqueTargetRoomIds.length === 0) {
      return ApiResponseUtil.error('At least one target room is required');
    }
    if (uniqueTargetRoomIds.length > ChatService.MAX_FORWARD_TARGETS) {
      return ApiResponseUtil.error(
        `You can forward to a maximum of ${ChatService.MAX_FORWARD_TARGETS} rooms at once`,
      );
    }

    const sourceMessage = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', { userId })
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .select([
        'message.id',
        'message.chatRoomId',
        'message.senderId',
        'message.content',
        'message.createdAt',
        'sender.username',
        'attachments.id',
        'attachments.url',
        'attachments.mimeType',
        'attachments.fileName',
        'attachments.size',
      ])
      .where('message.id = :messageId', { messageId: dto.sourceMessageId })
      .andWhere('message.isRemoved = :isRemoved', { isRemoved: false })
      .andWhere('deletion.id IS NULL')
      .getOne();

    if (!sourceMessage) {
      return ApiResponseUtil.error('Source message not found');
    }

    const canViewSource = await this.isUserInRoom(sourceMessage.chatRoomId, userId);
    if (!canViewSource) {
      return ApiResponseUtil.error('Access denied');
    }

    const targetRooms = await this.chatRoomRepository.find({
      where: { id: In(uniqueTargetRoomIds), isRemoved: false },
      select: { id: true },
    });
    if (targetRooms.length !== uniqueTargetRoomIds.length) {
      return ApiResponseUtil.error('One or more target rooms not found');
    }

    const memberships = await this.chatRoomParticipantRepository.find({
      where: { chatRoomId: In(uniqueTargetRoomIds), userId, isRemoved: false },
      select: { chatRoomId: true },
    });
    const accessibleRoomIds = new Set(memberships.map((m) => m.chatRoomId));
    const hasInaccessibleRoom = uniqueTargetRoomIds.some((id) => !accessibleRoomIds.has(id));
    if (hasInaccessibleRoom) {
      return ApiResponseUtil.error('Access denied for one or more target rooms');
    }

    const normalizedNote = (dto.note || '').trim();
    if (normalizedNote.length > 5000) {
      return ApiResponseUtil.error('Note must be at most 5000 characters');
    }
    const forwardedMessageMeta: Array<{ id: number; roomId: number }> = [];
    const sourceHasAttachments = (sourceMessage.attachments || []).length > 0;
    const sourceContent = (sourceMessage.content || '').trim();
    if (!sourceContent && !sourceHasAttachments) {
      return ApiResponseUtil.error('Nothing to forward');
    }

    try {
      await this.chatMessageRepository.manager.transaction(async (manager) => {
        const messageRepo = manager.getRepository(ChatMessage);
        const attachmentRepo = manager.getRepository(ChatAttachment);
        const roomRepo = manager.getRepository(ChatRoom);

        for (const targetRoomId of uniqueTargetRoomIds) {
          const forwardMessage = messageRepo.create({
            chatRoomId: targetRoomId,
            senderId: userId,
            content: normalizedNote,
            isForwarded: true,
            forwardedFromMessageId: sourceMessage.id,
            forwardedOriginalSenderId: sourceMessage.senderId,
            forwardedOriginalSenderName: sourceMessage.sender?.username || null,
            forwardedOriginalCreatedAt: sourceMessage.createdAt,
            forwardedOriginalContent: sourceContent || null,
          });

          const savedForwardMessage = await messageRepo.save(forwardMessage);

          if (sourceHasAttachments) {
            const attachmentEntities = (sourceMessage.attachments || []).map((file) =>
              attachmentRepo.create({
                messageId: savedForwardMessage.id,
                url: file.url,
                mimeType: file.mimeType,
                fileName: file.fileName,
                size: file.size,
              }),
            );
            await attachmentRepo.save(attachmentEntities);
          }

          await roomRepo.update(targetRoomId, { updatedAt: new Date() });
          forwardedMessageMeta.push({ id: savedForwardMessage.id, roomId: targetRoomId });
        }
      });
    } catch {
      return ApiResponseUtil.error('Failed to forward message');
    }

    const forwardedMessages: any[] = [];

    for (const item of forwardedMessageMeta) {
      const mappedForwardedMessage = await this.getMappedMessageById(item.id, userId, {
        includeIsRemoved: false,
        excludeDeletedForUser: false,
      });

      if (mappedForwardedMessage) {
        forwardedMessages.push(mappedForwardedMessage);
        this.chatGateway.sendToRoom(item.roomId, 'newMessage', mappedForwardedMessage);
        await this.emitMessageNotificationToRecipients(item.roomId, userId, mappedForwardedMessage);
      }
    }

    if (forwardedMessages.length === 0) {
      return ApiResponseUtil.error('Failed to load forwarded messages');
    }

    return ApiResponseUtil.success(forwardedMessages, 'Message forwarded successfully');
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

  async updateGroupRoomName(roomId: number, userId: number, name: string): Promise<ApiResponse> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
      select: { id: true, isGroupChat: true, name: true },
    });
    if (!room) {
      return ApiResponseUtil.error('Chat room not found');
    }
    if (!room.isGroupChat) {
      return ApiResponseUtil.error('Cannot rename a direct chat');
    }

    const isParticipant = await this.isUserInRoom(roomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    const normalizedName = (name || '').trim();
    if (!normalizedName) {
      return ApiResponseUtil.error('Group name is required');
    }
    if (room.name === normalizedName) {
      return ApiResponseUtil.success({ id: roomId, name: room.name }, 'No changes detected');
    }

    await this.chatRoomRepository.update(roomId, {
      name: normalizedName,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    this.chatGateway.sendToRoom(roomId, 'roomUpdated', {
      id: roomId,
      name: normalizedName,
      isGroupChat: true,
    });

    return ApiResponseUtil.success(
      { id: roomId, name: normalizedName },
      'Group room name updated successfully',
    );
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

  private createMessageDetailsQuery(options: {
    includeIsRemoved: boolean;
    currentUserId?: number;
    excludeDeletedForUser?: boolean;
  }): SelectQueryBuilder<ChatMessage> {
    const {
      includeIsRemoved,
      currentUserId,
      excludeDeletedForUser = false,
    } = options;

    const query = this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .leftJoinAndSelect('message.replyToMessage', 'replyToMessage')
      .leftJoin('replyToMessage.sender', 'replySender')
      .leftJoinAndSelect('message.forwardedFromMessage', 'forwardedFromMessage')
      .leftJoin('forwardedFromMessage.sender', 'forwardedSender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.reactions', 'reactions')
      .select(this.getMessageSelectFields(includeIsRemoved));

    if (excludeDeletedForUser && typeof currentUserId === 'number') {
      query.leftJoin('message.deletions', 'deletion', 'deletion.userId = :userId', {
        userId: currentUserId,
      });
    }

    return query;
  }

  private async getMappedMessageById(
    messageId: number,
    currentUserId: number,
    options: {
      includeIsRemoved: boolean;
      excludeDeletedForUser: boolean;
      requireNotRemoved?: boolean;
    },
  ) {
    const query = this.createMessageDetailsQuery({
      includeIsRemoved: options.includeIsRemoved,
      currentUserId,
      excludeDeletedForUser: options.excludeDeletedForUser,
    }).where('message.id = :messageId', { messageId });

    if (options.requireNotRemoved) {
      query.andWhere('message.isRemoved = :isRemoved', { isRemoved: false });
    }
    if (options.excludeDeletedForUser) {
      query.andWhere('deletion.id IS NULL');
    }

    const message = await query.getOne();
    return message ? this.toMessageDto(message, currentUserId) : null;
  }

  private async emitMessageNotificationToRecipients(
    chatRoomId: number,
    senderId: number,
    mappedMessage: any,
  ): Promise<void> {
    const recipients = await this.chatRoomParticipantRepository.find({
      where: { chatRoomId, isRemoved: false },
      select: { userId: true },
    });

    const senderName = mappedMessage.sender?.username || 'Someone';

    for (const p of recipients) {
      if (p.userId === senderId) continue;

      const notificationPayload: MessageNotificationPayload = {
        messageId: mappedMessage.id,
        chatRoomId: mappedMessage.chatRoomId,
        senderId,
        senderName,
        content: mappedMessage.content,
        replyTo: mappedMessage.replyTo,
        isForwarded: mappedMessage.isForwarded,
        forwardedFrom: mappedMessage.forwardedFrom,
        createdAt: mappedMessage.createdAt,
      };

      this.chatGateway.sendToUser(p.userId, 'messageNotification', notificationPayload);
    }
  }

  private async getLastMessage(roomId: number, userId: number): Promise<ChatMessage | null> {
    return this.createMessageDetailsQuery({
      includeIsRemoved: true,
      currentUserId: userId,
      excludeDeletedForUser: true,
    })
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
      'message.replyToMessageId',
      'message.isForwarded',
      'message.forwardedFromMessageId',
      'message.forwardedOriginalSenderId',
      'message.forwardedOriginalSenderName',
      'message.forwardedOriginalCreatedAt',
      'message.forwardedOriginalContent',
      'message.content',
      'message.createdAt',
      'message.updatedAt',
      'sender.username',
      'replyToMessage.id',
      'replyToMessage.senderId',
      'replyToMessage.content',
      'replyToMessage.createdAt',
      'replyToMessage.isRemoved',
      'replySender.username',
      'forwardedFromMessage.id',
      'forwardedFromMessage.senderId',
      'forwardedFromMessage.content',
      'forwardedFromMessage.createdAt',
      'forwardedFromMessage.isRemoved',
      'forwardedSender.username',
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

    const replyIsRemoved = !!message.replyToMessage?.isRemoved;
    const forwardedIsRemoved = !!message.forwardedFromMessage?.isRemoved;
    const forwardedSenderName =
      message.forwardedOriginalSenderName ||
      message.forwardedFromMessage?.sender?.username ||
      'Unknown user';
    const forwardedContentPreview =
      message.forwardedOriginalContent ||
      (forwardedIsRemoved
        ? 'This message was deleted'
        : message.forwardedFromMessage?.content || '');

    return {
      id: message.id,
      chatRoomId: message.chatRoomId,
      senderId: message.senderId,
      replyToMessageId: message.replyToMessageId,
      isForwarded: !!message.isForwarded,
      forwardedFromMessageId: message.forwardedFromMessageId,
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isRemoved: message.isRemoved,
      replyTo: message.replyToMessage
        ? {
          id: message.replyToMessage.id,
          senderId: message.replyToMessage.senderId,
          senderName: replyIsRemoved
            ? message.replyToMessage.sender?.username || 'Deleted user'
            : message.replyToMessage.sender?.username || 'Unknown user',
          content: replyIsRemoved
            ? 'This message was deleted'
            : message.replyToMessage.content,
          createdAt: message.replyToMessage.createdAt,
          isRemoved: replyIsRemoved,
        }
        : null,
      forwardedFrom: message.isForwarded
        ? {
          messageId: message.forwardedFromMessageId || message.forwardedFromMessage?.id || null,
          senderId:
            message.forwardedOriginalSenderId || message.forwardedFromMessage?.senderId || null,
          senderName: forwardedSenderName,
          createdAt:
            message.forwardedOriginalCreatedAt || message.forwardedFromMessage?.createdAt || null,
          contentPreview: forwardedContentPreview,
          isRemoved: forwardedIsRemoved,
        }
        : null,
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

    const mappedMessage = await this.getMappedMessageById(messageId, userId, {
      includeIsRemoved: true,
      excludeDeletedForUser: true,
      requireNotRemoved: true,
    });

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

  async editMessage(messageId: number, userId: number, content: string): Promise<ApiResponse> {
    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, isRemoved: false },
      select: { id: true, senderId: true, chatRoomId: true, content: true },
    });
    if (!message) {
      return ApiResponseUtil.error('Message not found');
    }

    const isParticipant = await this.isUserInRoom(message.chatRoomId, userId);
    if (!isParticipant) {
      return ApiResponseUtil.error('Access denied');
    }

    if (message.senderId !== userId) {
      return ApiResponseUtil.error('Only message sender can edit message');
    }

    const normalizedContent = (content || '').trim();
    if (!normalizedContent) {
      return ApiResponseUtil.error('Message content is required');
    }

    if (message.content === normalizedContent) {
      return ApiResponseUtil.success(null, 'No changes detected');
    }

    await this.chatMessageRepository.update(messageId, {
      content: normalizedContent,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    const mappedMessage = await this.getMappedMessageById(messageId, userId, {
      includeIsRemoved: true,
      excludeDeletedForUser: true,
      requireNotRemoved: true,
    });
    if (mappedMessage) {
      this.chatGateway.sendToRoom(message.chatRoomId, 'messageUpdated', mappedMessage);
    }

    return ApiResponseUtil.success(mappedMessage, 'Message updated successfully');
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
