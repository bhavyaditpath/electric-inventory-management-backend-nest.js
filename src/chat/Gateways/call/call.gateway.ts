import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CallLogsService } from 'src/chat/callLogs.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class CallGateway implements OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // userId -> talkingWith
  private activeCalls: Map<number, number> = new Map();
  private ringingUsers: Set<number> = new Set();

  // "userA_userB" -> callLogId
  private callSessions: Map<string, number> = new Map();

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => CallLogsService))
    private callLogsService: CallLogsService,
  ) { }

  private getUserId(client: Socket): number | null {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) return null;

      const payload = this.jwtService.verify(token);
      return payload.sub;
    } catch {
      return null;
    }
  }


  private getCallKey(a: number, b: number) {
    return [a, b].sort().join('_');
  }

  private sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  async handleConnection(client: Socket) {
    try {
      const userId = this.getUserId(client);
      client.join(`user_${userId}`);
    } catch { }
  }

  // ================= CALL USER =================

  @SubscribeMessage('callUser')
  async handleCallUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId: number; roomId: number },
  ) {
    const callerId = this.getUserId(client);
    if (!callerId) return;

    if (callerId === data.targetUserId) return;

    if (this.activeCalls.has(data.targetUserId) || this.ringingUsers.has(data.targetUserId)) {
      this.sendToUser(callerId, 'userBusy', {});
      return;
    }

    this.ringingUsers.add(data.targetUserId);

    const log = await this.callLogsService.createOutgoingCallLog(
      data.roomId,
      callerId,
      data.targetUserId,
    );

    const key = this.getCallKey(callerId, data.targetUserId);
    this.callSessions.set(key, log.id);

    this.sendToUser(data.targetUserId, 'incomingCall', {
      callerId,
      roomId: data.roomId,
      callLogId: log.id,
    });
  }


  // ================= ACCEPT =================
  @SubscribeMessage('acceptCall')
  async handleAcceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: number },
  ) {
    const receiverId = this.getUserId(client);
    if (!receiverId) return;

    // call must exist
    const key = this.getCallKey(receiverId, data.callerId);
    const callLogId = this.callSessions.get(key);
    if (!callLogId) return;

    // already in call
    if (this.activeCalls.has(receiverId) || this.activeCalls.has(data.callerId)) return;

    // remove ringing state
    this.ringingUsers.delete(receiverId);
    this.ringingUsers.delete(data.callerId);

    // set active call
    this.activeCalls.set(receiverId, data.callerId);
    this.activeCalls.set(data.callerId, receiverId);

    await this.callLogsService.markCallAnswered(callLogId);

    this.sendToUser(data.callerId, 'callAccepted', { receiverId });
  }

  // ================= REJECT =================
  @SubscribeMessage('rejectCall')
  async handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: number },
  ) {
    const receiverId = this.getUserId(client);
    if (!receiverId) return;

    const key = this.getCallKey(receiverId, data.callerId);
    const callLogId = this.callSessions.get(key);
    if (!callLogId) return;

    // clear ringing state
    this.ringingUsers.delete(receiverId);
    this.ringingUsers.delete(data.callerId);

    await this.callLogsService.markCallRejected(callLogId);
    this.callSessions.delete(key);

    this.sendToUser(data.callerId, 'callRejected', {});
  }


  // ================= END =================
  @SubscribeMessage('endCall')
  async handleEndCall(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const otherUser = this.activeCalls.get(userId);
    if (!otherUser) return;

    const key = this.getCallKey(userId, otherUser);
    const callLogId = this.callSessions.get(key);

    if (callLogId) {
      await this.callLogsService.finishCall(callLogId);
      this.callSessions.delete(key);
    }

    // cleanup states
    this.activeCalls.delete(userId);
    this.activeCalls.delete(otherUser);
    this.ringingUsers.delete(userId);
    this.ringingUsers.delete(otherUser);

    this.sendToUser(otherUser, 'callEnded', {});
  }


  // ================= DISCONNECT =================

  // ================= DISCONNECT =================
  async handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    // CASE 1: user was in active call
    const otherUser = this.activeCalls.get(userId);
    if (otherUser) {
      const key = this.getCallKey(userId, otherUser);
      const callLogId = this.callSessions.get(key);

      if (callLogId) {
        await this.callLogsService.finishCall(callLogId);
        this.callSessions.delete(key);
      }

      this.activeCalls.delete(userId);
      this.activeCalls.delete(otherUser);
      this.ringingUsers.delete(userId);
      this.ringingUsers.delete(otherUser);

      this.sendToUser(otherUser, 'callEnded', {});
      return;
    }

    // CASE 2: user was ringing (missed call)
    for (const [key, callLogId] of this.callSessions.entries()) {
      if (key.includes(`${userId}`)) {
        await this.callLogsService.markCallCancelled(callLogId);
        this.callSessions.delete(key);
      }
    }

    this.ringingUsers.delete(userId);
  }


  // ================= WEBRTC SIGNALING =================

  @SubscribeMessage('offer')
  handleOffer(@MessageBody() data: { targetUserId: number; offer: any }) {
    this.sendToUser(data.targetUserId, 'offer', data.offer);
  }

  @SubscribeMessage('answer')
  handleAnswer(@MessageBody() data: { targetUserId: number; answer: any }) {
    this.sendToUser(data.targetUserId, 'answer', data.answer);
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(@MessageBody() data: { targetUserId: number; candidate: any }) {
    this.sendToUser(data.targetUserId, 'iceCandidate', data.candidate);
  }
}
