import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { mkdirSync } from 'fs';
import { ChatService } from './chat.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseUtil } from '../shared/api-response';

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
}
