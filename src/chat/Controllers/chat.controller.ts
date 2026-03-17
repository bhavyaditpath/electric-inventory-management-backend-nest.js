import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Delete,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  StreamableFile,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join, extname, basename } from 'path';
import { mkdirSync, existsSync, createReadStream } from 'fs';
import { ChatService } from '../chat.service';
import { CreateChatRoomDto } from '../dto/create-chat-room.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { AddParticipantsDto } from '../dto/add-participants.dto';
import { PinChatRoomDto } from '../dto/pin-chat-room.dto';
import { PinMessageDto } from '../dto/pin-message.dto';
import { RemoveParticipantDto } from '../dto/remove-participant.dto';
import { ToggleMessageReactionDto } from '../dto/toggle-message-reaction.dto';
import { UpdateChatRoomNameDto } from '../dto/update-chat-room-name.dto';
import { EditMessageDto } from '../dto/edit-message.dto';
import { ForwardMessageDto } from '../dto/forward-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiResponseUtil } from '../../shared/api-response';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private static readonly uploadDir = join(process.cwd(), 'uploads', 'chat');
  private static readonly maxFileSize = 10 * 1024 * 1024; // 10 MB

  private static ensureUploadDir() {
    mkdirSync(ChatController.uploadDir, { recursive: true });
  }

  private static fileFilter(
    _req: any,
    file: { mimetype: string },
    cb: Function,
  ) {
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    if (isImage || isPdf) {
      cb(null, true);
      return;
    }
    cb(new BadRequestException('Only images and PDFs are allowed'), false);
  }

  private static storage = diskStorage({
    destination: (_req, _file, cb) => {
      ChatController.ensureUploadDir();
      cb(null, ChatController.uploadDir);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(safeName)}`);
    },
  });

  @Post('rooms')
  async createRoom(@Body() dto: CreateChatRoomDto, @Request() req) {
    return this.chatService.createChatRoom(dto, req.user.id);
  }

  @Get('rooms')
  async getMyRooms(@Request() req) {
    return this.chatService.getUserChatRooms(req.user.id);
  }

  @Get('rooms/:id')
  async getRoom(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.chatService.getChatRoom(id, req.user.id);
  }

  @Post('rooms/direct/:userId')
  async getOrCreateDirectChat(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req,
  ) {
    return this.chatService.getOrCreateDirectChat(req.user.id, userId);
  }

  @Post('rooms/:roomId/participants')
  async addParticipants(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: AddParticipantsDto,
    @Request() req,
  ) {
    return this.chatService.addParticipants(roomId, dto, req.user.id);
  }

  @Post('rooms/:roomId/participants/remove')
  async removeParticipant(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: RemoveParticipantDto,
    @Request() req,
  ) {
    return this.chatService.removeParticipant(roomId, req.user.id, dto);
  }

  @Post('rooms/:roomId/pin')
  async pinRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: PinChatRoomDto,
    @Request() req,
  ) {
    return this.chatService.setRoomPinned(roomId, req.user.id, dto.pinned);
  }

  @Post('rooms/:roomId/messages/:messageId/pin')
  async pinMessage(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: PinMessageDto,
    @Request() req,
  ) {
    return this.chatService.setMessagePinned(roomId, messageId, req.user.id, dto.pinned);
  }

  @Get('rooms/:roomId/pinned-messages')
  async getPinnedMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Request() req,
  ) {
    return this.chatService.getPinnedMessages(roomId, req.user.id);
  }

  @Patch('rooms/:roomId/name')
  async updateRoomName(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: UpdateChatRoomNameDto,
    @Request() req,
  ) {
    return this.chatService.updateGroupRoomName(roomId, req.user.id, dto.name);
  }

  @Get('users')
  async getUsers(@Request() req, @Query('search') search?: string) {
    return this.chatService.getUsersForChat(req.user.id, search);
  }

  @Get('users/online-status')
  async getUsersWithOnlineStatus(@Request() req) {
    return this.chatService.getUsersWithOnlineStatus(req.user.id);
  }

  @Post('messages')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: ChatController.storage,
      fileFilter: ChatController.fileFilter,
      limits: { fileSize: ChatController.maxFileSize },
    }),
  )
  async sendMessage(
    @Body() dto: SendMessageDto,
    @UploadedFiles()
    files: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      filename: string;
    }>,
    @Request() req,
  ) {
    return this.chatService.sendMessage(dto, req.user.id, undefined, files);
  }

  @Post('messages/forward')
  async forwardMessage(@Body() dto: ForwardMessageDto, @Request() req) {
    return this.chatService.forwardMessage(dto, req.user.id);
  }

  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Request() req,
    @Res({ passthrough: true }) res: any,
  ) {
    const attachment = await this.chatService.getAttachmentForDownload(
      attachmentId,
      req.user.id,
    );
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Check for view-once access
    if (attachment.isViewOnce) {
      const access = await this.chatService.getViewOnceAttachmentAccess(
        attachmentId,
        req.user.id,
      );
      if (!access.canView) {
        throw new NotFoundException(access.error || 'View-once attachment already viewed');
      }
    }

    const storedName = basename(attachment.url);
    const filePath = join(process.cwd(), 'uploads', 'chat', storedName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
    );

    return new StreamableFile(createReadStream(filePath));
  }

  @Post('attachments/:attachmentId/view-once/view')
  async viewViewOnceAttachment(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Request() req,
  ) {
    return this.chatService.recordViewOnceAttachmentView(attachmentId, req.user.id);
  }

  @Get('attachments/:attachmentId/view-once/status')
  async getViewOnceAttachmentStatus(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Request() req,
  ) {
    const attachment = await this.chatService.getAttachmentForDownload(
      attachmentId,
      req.user.id,
    );
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (!attachment.isViewOnce) {
      return ApiResponseUtil.success({ isViewOnce: false, isViewed: false });
    }

    const isViewed = await this.chatService.checkViewOnceAttachmentViewed(
      attachmentId,
      req.user.id,
    );

    return ApiResponseUtil.success({ isViewOnce: true, isViewed });
  }

  @Delete('messages/:messageId')
  async deleteMessage(@Param('messageId', ParseIntPipe) messageId: number, @Request() req) {
    return this.chatService.deleteMessage(messageId, req.user.id);
  }

  @Patch('messages/:messageId')
  async editMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: EditMessageDto,
    @Request() req,
  ) {
    return this.chatService.editMessage(messageId, req.user.id, dto);
  }

  @Post('messages/:messageId/reactions')
  async toggleMessageReaction(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: ToggleMessageReactionDto,
    @Request() req,
  ) {
    return this.chatService.toggleMessageReaction(messageId, req.user.id, dto.emoji);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? +page : 1;
    const limitNum = limit ? +limit : 50;
    return this.chatService.getMessages(roomId, req.user.id, pageNum, limitNum);
  }

  @Post('rooms/:roomId/read')
  async markAsRead(@Param('roomId', ParseIntPipe) roomId: number, @Request() req) {
    return this.chatService.markMessagesAsRead(roomId, req.user.id);
  }

  @Delete('rooms/:roomId')
  async deleteRoom(@Param('roomId', ParseIntPipe) roomId: number, @Request() req) {
    return this.chatService.deleteChatRoom(roomId, req.user.id);
  }
}
