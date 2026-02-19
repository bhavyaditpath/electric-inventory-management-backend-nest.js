import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../../chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<number, Set<string>> = new Map(); // userId -> socketIds

  constructor(
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    private jwtService: JwtService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Store user connection
      const existingSockets = this.connectedUsers.get(userId);
      const sockets = existingSockets || new Set<string>();
      const wasOnline = sockets.size > 0;
      sockets.add(client.id);
      this.connectedUsers.set(userId, sockets);
      client.join(`user_${userId}`);

      console.log(`User ${userId} connected to chat`);

      // Notify others that user is online
      if (!wasOnline) {
        client.broadcast.emit('userOnline', { userId });
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Find user by socketId and remove
    for (const [userId, socketIds] of this.connectedUsers.entries()) {
      if (socketIds.has(client.id)) {
        socketIds.delete(client.id);
        if (socketIds.size === 0) {
          this.connectedUsers.delete(userId);
          console.log(`User ${userId} disconnected from chat`);
          // Notify others that user is offline
          client.broadcast.emit('userOffline', { userId });
        }
        break;
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    try {
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return { event: 'error', data: 'Unauthorized' };
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const isParticipant = await this.chatService.isUserInRoom(data.roomId, userId);
      if (!isParticipant) {
        return { event: 'error', data: 'Not a participant of this room' };
      }

      client.join(`room_${data.roomId}`);
      console.log(`Client joined room ${data.roomId}`);
      return { event: 'joinedRoom', data: { roomId: data.roomId } };
    } catch (error) {
      console.error('Join room error:', error);
      return { event: 'error', data: 'Failed to join room' };
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    client.leave(`room_${data.roomId}`);
    console.log(`Client left room ${data.roomId}`);
    return { event: 'leftRoom', data: { roomId: data.roomId } };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; content: string },
  ) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Save message to database
      const result = await this.chatService.sendMessage(
        { chatRoomId: data.roomId, content: data.content },
        userId,
        { emit: true }, // important
      );

      if (result.success && result.data) {
        const message = result.data;

        // Broadcast to room
        this.server.to(`room_${data.roomId}`).emit('newMessage', message);

        // Send notification to specific user if it's a direct chat
        // You can add logic here to identify the other participant and send personal notification

        return { event: 'messageSent', data: message };
      }

      return { event: 'error', data: 'Failed to send message' };
    } catch (error) {
      console.error('Send message error:', error);
      return { event: 'error', data: 'Failed to send message' };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; isTyping: boolean },
  ) {
    try {
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return { event: 'error', data: 'Unauthorized' };
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const isParticipant = await this.chatService.isUserInRoom(data.roomId, userId);
      if (!isParticipant) {
        return { event: 'error', data: 'Not a participant of this room' };
      }

      // Broadcast typing status to room (except sender)
      client.to(`room_${data.roomId}`).emit('userTyping', {
        userId,
        isTyping: data.isTyping,
      });
    } catch (error) {
      console.error('Typing error:', error);
      return { event: 'error', data: 'Failed to send typing status' };
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
    const payload = this.jwtService.verify(token);
    const userId = payload.sub;

    await this.chatService.markMessagesAsRead(data.roomId, userId);

    return { event: 'markedAsRead', data: { roomId: data.roomId } };
  }

  // Helper method to send notification to specific user
  sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  // Helper method to send notification to room
  sendToRoom(roomId: number, event: string, data: any) {
    this.server.to(`room_${roomId}`).emit(event, data);
  }

  // Get online users
  getOnlineUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId: number): boolean {
    const sockets = this.connectedUsers.get(userId);
    return !!sockets && sockets.size > 0;
  }
}
