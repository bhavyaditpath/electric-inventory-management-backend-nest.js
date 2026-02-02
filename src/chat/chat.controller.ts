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
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseUtil } from '../shared/api-response';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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

  @Get('users')
  async getUsers(@Request() req, @Query('search') search?: string) {
    return this.chatService.getUsersForChat(req.user.id, search);
  }

  @Get('users/online-status')
  async getUsersWithOnlineStatus(@Request() req) {
    return this.chatService.getUsersWithOnlineStatus(req.user.id);
  }

  @Post('messages')
  async sendMessage(@Body() dto: SendMessageDto, @Request() req) {
    return this.chatService.sendMessage(dto, req.user.id);
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
