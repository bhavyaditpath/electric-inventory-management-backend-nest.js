import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CallLogsService } from 'src/chat/callLogs.service';
import { CallType } from 'src/shared/enums/callType.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from 'src/chat/entities/chat-room.entity';
import { ChatRoomParticipant } from 'src/chat/entities/chat-room-participant.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class CallGateway implements OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // userId -> active peer userIds
  private activeCalls: Map<number, Set<number>> = new Map();
  private ringingUsers: Set<number> = new Set();
  private callTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // "userA_userB" -> callLogId
  private callSessions: Map<string, number> = new Map();
  private callSessionMeta: Map<
    string,
    { callerId: number; receiverId: number; roomId: number; callType: CallType }
  > = new Map();

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => CallLogsService))
    private callLogsService: CallLogsService,
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatRoomParticipant)
    private chatRoomParticipantRepository: Repository<ChatRoomParticipant>,
  ) { }

  private getUserId(client: Socket): number | null {
    const tokenFromAuth: unknown = client.handshake.auth.token;
    const tokenFromHeader =
      client.handshake.headers.authorization?.split(' ')[1];
    const token =
      typeof tokenFromAuth === 'string' ? tokenFromAuth : tokenFromHeader;
    if (!token) return null;

    try {
      const payload = this.jwtService.verify<{ sub: number }>(token);
      return typeof payload.sub === 'number' ? payload.sub : null;
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

  private clearCallTimeout(key: string) {
    const timeout = this.callTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.callTimeouts.delete(key);
    }
  }

  private getActivePeers(userId: number): Set<number> {
    return this.activeCalls.get(userId) ?? new Set<number>();
  }

  private hasActiveCall(userId: number): boolean {
    return this.getActivePeers(userId).size > 0;
  }

  private addActivePeer(userId: number, peerId: number) {
    const current = this.getActivePeers(userId);
    current.add(peerId);
    this.activeCalls.set(userId, current);
  }

  private removeActivePeer(userId: number, peerId: number) {
    const current = this.activeCalls.get(userId);
    if (!current) return;
    current.delete(peerId);
    if (current.size === 0) {
      this.activeCalls.delete(userId);
      return;
    }
    this.activeCalls.set(userId, current);
  }

  private async getRoomTargets(
    roomId: number,
    callerId: number,
    targetUserId?: number,
  ) {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
    });
    if (!room) return { room: null, targets: [] as number[] };

    const callerIsParticipant = await this.chatRoomParticipantRepository.count({
      where: { chatRoomId: roomId, userId: callerId, isRemoved: false },
    });
    if (!callerIsParticipant) return { room, targets: [] as number[] };

    if (targetUserId) {
      const targetIsParticipant =
        await this.chatRoomParticipantRepository.count({
          where: { chatRoomId: roomId, userId: targetUserId, isRemoved: false },
        });
      if (!targetIsParticipant || targetUserId === callerId)
        return { room, targets: [] as number[] };
      return { room, targets: [targetUserId] };
    }

    const participants = await this.chatRoomParticipantRepository.find({
      where: { chatRoomId: roomId, isRemoved: false },
      select: { userId: true },
    });

    const targets = participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== callerId);

    return { room, targets };
  }

  private cleanupCallSession(key: string) {
    this.callSessions.delete(key);
    this.callSessionMeta.delete(key);
    this.clearCallTimeout(key);
  }

  handleConnection(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;
    void client.join(`user_${userId}`);
  }

  // ================= CALL USER =================

  @SubscribeMessage('callUser')
  async handleCallUser(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { targetUserId?: number; roomId: number; callType?: CallType },
  ) {
    const callerId = this.getUserId(client);
    if (!callerId) return;

    const { room, targets } = await this.getRoomTargets(
      data.roomId,
      callerId,
      data.targetUserId,
    );
    if (!room || targets.length === 0) return;

    const callerName =
      await this.callLogsService.getUserDisplayNameById(callerId);
    const callType = data.callType ?? CallType.AUDIO;

    for (const targetUserId of targets) {
      const key = this.getCallKey(callerId, targetUserId);
      if (this.callSessions.has(key)) continue;

      if (
        this.hasActiveCall(targetUserId) ||
        this.ringingUsers.has(targetUserId)
      ) {
        this.sendToUser(callerId, 'userBusy', { targetUserId });
        continue;
      }

      this.ringingUsers.add(targetUserId);

      const log = await this.callLogsService.createOutgoingCallLog(
        data.roomId,
        callerId,
        targetUserId,
        callType,
      );

      this.callSessions.set(key, log.id);
      this.callSessionMeta.set(key, {
        callerId,
        receiverId: targetUserId,
        roomId: data.roomId,
        callType,
      });

      this.sendToUser(targetUserId, 'incomingCall', {
        callerId,
        callerName,
        roomId: data.roomId,
        callLogId: log.id,
        callType,
        isGroupCall: room.isGroupChat,
      });

      const timeout = setTimeout(() => {
        void (async () => {
          if (!this.callSessions.has(key)) return;
          if (!this.ringingUsers.has(targetUserId)) return;

          await this.callLogsService.markCallMissed(log.id);
          this.cleanupCallSession(key);
          this.ringingUsers.delete(targetUserId);

          this.sendToUser(callerId, 'callNoAnswer', { targetUserId });
          this.sendToUser(targetUserId, 'missedCall', {
            callerId,
            callerName,
            roomId: data.roomId,
            callLogId: log.id,
            callType,
            isGroupCall: room.isGroupChat,
          });
        })();
      }, 90000);

      this.callTimeouts.set(key, timeout);
    }
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

    // receiver cannot join two unrelated calls at once
    const receiverPeers = this.getActivePeers(receiverId);
    if (receiverPeers.size > 0 && !receiverPeers.has(data.callerId)) return;

    // remove ringing state
    this.ringingUsers.delete(receiverId);
    this.clearCallTimeout(key);

    // set active call
    this.addActivePeer(receiverId, data.callerId);
    this.addActivePeer(data.callerId, receiverId);

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

    await this.callLogsService.markCallRejected(callLogId);
    this.cleanupCallSession(key);

    this.sendToUser(data.callerId, 'callRejected', {});
  }

  // ================= CANCEL =================
  @SubscribeMessage('cancelCall')
  async handleCancelCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId?: number; roomId?: number },
  ) {
    const callerId = this.getUserId(client);
    if (!callerId) return;

    // In group calls, once at least one participant has accepted,
    // do not cancel remaining ringing participants via bulk cancel.
    // They should still be able to join the same ongoing call.
    if (!data.targetUserId && this.hasActiveCall(callerId)) return;

    if (data.targetUserId) {
      const key = this.getCallKey(callerId, data.targetUserId);
      const callLogId = this.callSessions.get(key);
      if (!callLogId) return;

      await this.callLogsService.markCallCancelled(callLogId);
      this.cleanupCallSession(key);
      this.ringingUsers.delete(data.targetUserId);

      this.sendToUser(data.targetUserId, 'callCancelled', {
        byUserId: callerId,
      });
      return;
    }

    for (const [key, callLogId] of this.callSessions.entries()) {
      const meta = this.callSessionMeta.get(key);
      if (!meta || meta.callerId !== callerId) continue;
      if (data.roomId && meta.roomId !== data.roomId) continue;
      if (!this.ringingUsers.has(meta.receiverId)) continue;

      await this.callLogsService.markCallCancelled(callLogId);
      this.cleanupCallSession(key);
      this.ringingUsers.delete(meta.receiverId);

      this.sendToUser(meta.receiverId, 'callCancelled', {
        byUserId: callerId,
      });
    }
  }

  // ================= END =================
  @SubscribeMessage('endCall')
  async handleEndCall(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const peers = Array.from(this.getActivePeers(userId));
    if (peers.length === 0) return;

    for (const peerId of peers) {
      const key = this.getCallKey(userId, peerId);
      const callLogId = this.callSessions.get(key);

      if (callLogId) {
        await this.callLogsService.finishCall(callLogId);
        this.cleanupCallSession(key);
      }

      this.removeActivePeer(userId, peerId);
      this.removeActivePeer(peerId, userId);

      this.sendToUser(peerId, 'callEnded', { byUserId: userId });
    }

    this.ringingUsers.delete(userId);
  }

  // ================= DISCONNECT =================
  async handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    // CASE 1: user was in active call(s)
    const peers = Array.from(this.getActivePeers(userId));
    for (const peerId of peers) {
      const key = this.getCallKey(userId, peerId);
      const callLogId = this.callSessions.get(key);
      if (callLogId) {
        await this.callLogsService.finishCall(callLogId);
        this.cleanupCallSession(key);
      }
      this.removeActivePeer(peerId, userId);
      this.sendToUser(peerId, 'callEnded', {
        byUserId: userId,
        reason: 'disconnect',
      });
    }
    this.activeCalls.delete(userId);

    // CASE 2: user was ringing/pending
    for (const [key, callLogId] of this.callSessions.entries()) {
      const meta = this.callSessionMeta.get(key);
      if (!meta) continue;
      if (meta.callerId !== userId && meta.receiverId !== userId) continue;

      const otherUserId =
        meta.callerId === userId ? meta.receiverId : meta.callerId;

      await this.callLogsService.markCallCancelled(callLogId);
      this.cleanupCallSession(key);
      this.removeActivePeer(otherUserId, userId);

      // notify other side to stop ringing immediately
      this.sendToUser(otherUserId, 'callCancelled', {
        byUserId: userId,
        reason: 'disconnect',
      });
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
  handleIceCandidate(
    @MessageBody() data: { targetUserId: number; candidate: any },
  ) {
    this.sendToUser(data.targetUserId, 'iceCandidate', data.candidate);
  }
}
