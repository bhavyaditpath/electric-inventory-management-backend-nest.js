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

  private activeSessions = new Map<string, CallSessionState>();
  private activeSessionByRoom = new Map<number, string>();
  private userSessions = new Map<number, Set<string>>();
  private participantTimeouts = new Map<string, NodeJS.Timeout>();

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

  private generateSessionId(roomId: number, hostId: number) {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${roomId}_${hostId}_${Date.now()}_${randomPart}`.slice(0, 64);
  }

  private sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  private getParticipantTimeoutKey(sessionId: string, userId: number) {
    return `${sessionId}:${userId}`;
  }

  private clearParticipantTimeout(sessionId: string, userId: number) {
    const key = this.getParticipantTimeoutKey(sessionId, userId);
    const timeout = this.participantTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.participantTimeouts.delete(key);
    }
  }

  private addUserSession(userId: number, sessionId: string) {
    const sessions = this.userSessions.get(userId) ?? new Set<string>();
    sessions.add(sessionId);
    this.userSessions.set(userId, sessions);
  }

  private removeUserSession(userId: number, sessionId: string) {
    const sessions = this.userSessions.get(userId);
    if (!sessions) return;
    sessions.delete(sessionId);
    if (sessions.size === 0) {
      this.userSessions.delete(userId);
      return;
    }
    this.userSessions.set(userId, sessions);
  }

  private async validateRoomMembership(userId: number, roomId: number) {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, isRemoved: false },
    });
    if (!room) return false;

    const count = await this.chatRoomParticipantRepository.count({
      where: { chatRoomId: roomId, userId, isRemoved: false },
    });

    return count > 0;
  }

  private validateSessionParticipant(sessionId: string, userId: number) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    if (!session.participants.has(userId)) return null;
    return session;
  }

  private emitParticipantUpdate(
    session: CallSessionState,
    participantUserId: number,
    state: CallParticipantState,
    reason?: string,
  ) {
    const payload = {
      sessionId: session.sessionId,
      roomId: session.roomId,
      userId: participantUserId,
      state,
      reason,
      updatedAt: new Date(),
    };

    for (const userId of session.participants.keys()) {
      this.sendToUser(userId, 'call:participant-update', payload);
    }
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

  private cleanupSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    for (const userId of session.participants.keys()) {
      this.clearParticipantTimeout(sessionId, userId);
      this.removeUserSession(userId, sessionId);
    }

    this.activeSessions.delete(sessionId);
    this.activeSessionByRoom.delete(session.roomId);
  }

  private async finishSession(
    session: CallSessionState,
    endedByUserId?: number,
    reason?: string,
  ) {
    for (const participant of session.participants.values()) {
      if (participant.callLogId) {
        if (participant.state === 'joined') {
          await this.callLogsService.finishCall(participant.callLogId);
        } else if (
          participant.state === 'ringing' ||
          participant.state === 'invited'
        ) {
          await this.callLogsService.markCallCancelled(participant.callLogId);
        }
      }

      this.clearParticipantTimeout(session.sessionId, participant.userId);
      this.sendToUser(participant.userId, 'call:end', {
        sessionId: session.sessionId,
        roomId: session.roomId,
        endedByUserId,
        reason,
      });
      this.sendToUser(participant.userId, 'callEnded', {
        byUserId: endedByUserId,
        reason,
        sessionId: session.sessionId,
      });
    }

    this.cleanupSession(session.sessionId);
  }

  private findSessionByHostAndParticipant(hostId: number, userId: number) {
    for (const session of this.activeSessions.values()) {
      if (session.hostId !== hostId) continue;
      if (session.participants.has(userId)) return session;
    }
    return null;
  }

  private getJoinedParticipants(session: CallSessionState) {
    return Array.from(session.participants.values())
      .filter((participant) => participant.state === 'joined')
      .map((participant) => participant.userId);
  }

  private hasNonHostActiveParticipant(session: CallSessionState) {
    return Array.from(session.participants.values()).some(
      (participant) =>
        participant.userId !== session.hostId &&
        (participant.state === 'joined' ||
          participant.state === 'ringing' ||
          participant.state === 'invited'),
    );
  }

  private async markParticipantMissed(
    session: CallSessionState,
    targetUserId: number,
  ) {
    const participant = session.participants.get(targetUserId);
    if (!participant) return;
    if (participant.state !== 'ringing' && participant.state !== 'invited')
      return;

    participant.state = 'missed';
    participant.leftAt = new Date();
    session.participants.set(targetUserId, participant);

    if (participant.callLogId) {
      await this.callLogsService.markCallMissed(participant.callLogId);
    }

    this.emitParticipantUpdate(session, targetUserId, 'missed', 'timeout');
    this.sendToUser(session.hostId, 'callNoAnswer', { targetUserId });
    this.sendToUser(targetUserId, 'missedCall', {
      callerId: session.hostId,
      roomId: session.roomId,
      callLogId: participant.callLogId,
      callType: session.callType,
      sessionId: session.sessionId,
    });

    if (!this.hasNonHostActiveParticipant(session)) {
      await this.finishSession(session, session.hostId, 'no-participants');
    }
  }

  private setParticipantRingingTimeout(
    session: CallSessionState,
    targetUserId: number,
  ) {
    const key = this.getParticipantTimeoutKey(session.sessionId, targetUserId);
    this.clearParticipantTimeout(session.sessionId, targetUserId);

    const timeout = setTimeout(() => {
      void this.markParticipantMissed(session, targetUserId);
    }, 30000);

    this.participantTimeouts.set(key, timeout);
  }

  private async leaveSession(
    session: CallSessionState,
    userId: number,
    reason?: string,
  ) {
    const participant = session.participants.get(userId);
    if (!participant) return;

    if (participant.state === 'left' || participant.state === 'declined') return;

    this.clearParticipantTimeout(session.sessionId, userId);

    if (participant.callLogId) {
      if (participant.state === 'joined') {
        await this.callLogsService.finishCall(participant.callLogId);
      } else if (
        participant.state === 'ringing' ||
        participant.state === 'invited'
      ) {
        await this.callLogsService.markCallCancelled(participant.callLogId);
      }
    }

    participant.state = 'left';
    participant.leftAt = new Date();
    session.participants.set(userId, participant);

    this.emitParticipantUpdate(session, userId, 'left', reason);
    this.sendToUser(userId, 'call:leave', {
      sessionId: session.sessionId,
      roomId: session.roomId,
      userId,
      reason,
    });

    if (!this.hasNonHostActiveParticipant(session)) {
      await this.finishSession(session, userId, reason ?? 'last-participant-left');
      return;
    }

    if (this.getJoinedParticipants(session).length === 0) {
      await this.finishSession(session, userId, reason ?? 'last-participant-left');
    }
  }

  private isSignalingState(state: CallParticipantState) {
    return state === 'joined' || state === 'ringing' || state === 'invited';
  }

  private canSignal(session: CallSessionState, fromUserId: number, targetUserId: number) {
    const from = session.participants.get(fromUserId);
    const to = session.participants.get(targetUserId);
    if (!from || !to) return false;
    return this.isSignalingState(from.state) && this.isSignalingState(to.state);
  }

  private async startSession(
    callerId: number,
    roomId: number,
    callType: CallType,
    targetUserId?: number,
  ) {
    const callerInRoom = await this.validateRoomMembership(callerId, roomId);
    if (!callerInRoom) return null;

    const existingSessionId = this.activeSessionByRoom.get(roomId);
    if (existingSessionId && this.activeSessions.has(existingSessionId)) {
      return null;
    }

    const { room, targets } = await this.getRoomTargets(roomId, callerId, targetUserId);
    if (!room || targets.length === 0) return null;

    const sessionId = this.generateSessionId(roomId, callerId);
    const startedAt = new Date();
    const participants = new Map<number, CallSessionParticipant>();
    participants.set(callerId, {
      userId: callerId,
      state: 'joined',
      invitedAt: startedAt,
      joinedAt: startedAt,
    });

    for (const targetId of targets) {
      const log = await this.callLogsService.createOutgoingCallLog(
        roomId,
        callerId,
        targetId,
        callType,
        sessionId,
      );

      participants.set(targetId, {
        userId: targetId,
        state: 'ringing',
        callLogId: log.id,
        invitedAt: startedAt,
      });
    }

    const session: CallSessionState = {
      sessionId,
      roomId,
      hostId: callerId,
      callType,
      startedAt,
      isGroupCall: room.isGroupChat,
      participants,
    };

    this.activeSessions.set(sessionId, session);
    this.activeSessionByRoom.set(roomId, sessionId);

    for (const userId of participants.keys()) {
      this.addUserSession(userId, sessionId);
    }

    return session;
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
    const userId = this.getUserId(client);
    if (!userId) return;

    await this.handleCallStart(client, {
      roomId: data.roomId,
      targetUserId: data.targetUserId,
      callType: data.callType,
    });
  }

  @SubscribeMessage('call:start')
  async handleCallStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { targetUserId?: number; roomId: number; callType?: CallType },
  ) {
    const callerId = this.getUserId(client);
    if (!callerId) return;

    const roomId = Number(data.roomId);
    if (!roomId) return;

    const existingSessionId = this.activeSessionByRoom.get(roomId);
    if (existingSessionId && this.activeSessions.has(existingSessionId)) {
      this.sendToUser(callerId, 'userBusy', {
        roomId,
        sessionId: existingSessionId,
      });
      return;
    }

    const callType = data.callType ?? CallType.AUDIO;
    const session = await this.startSession(
      callerId,
      roomId,
      callType,
      data.targetUserId,
    );
    if (!session) return;

    const callerName = await this.callLogsService.getUserDisplayNameById(callerId);
    this.sendToUser(callerId, 'call:start', {
      sessionId: session.sessionId,
      roomId: session.roomId,
      hostId: callerId,
      callType: session.callType,
      startedAt: session.startedAt,
    });

    for (const participant of session.participants.values()) {
      if (participant.userId === callerId) continue;

      this.sendToUser(participant.userId, 'call:invite', {
        sessionId: session.sessionId,
        roomId: session.roomId,
        callerId,
        callerName,
        targetUserId: participant.userId,
        callType: session.callType,
      });

      this.sendToUser(participant.userId, 'incomingCall', {
        callerId,
        callerName,
        roomId: session.roomId,
        callLogId: participant.callLogId,
        callType: session.callType,
        isGroupCall: session.isGroupCall,
        sessionId: session.sessionId,
      });

      this.emitParticipantUpdate(session, participant.userId, 'ringing');
      this.setParticipantRingingTimeout(session, participant.userId);
    }
  }

  // ================= ACCEPT =================
  @SubscribeMessage('acceptCall')
  async handleAcceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: number; sessionId?: string },
  ) {
    await this.handleCallJoin(client, {
      sessionId: data.sessionId,
      callerId: data.callerId,
    });
  }

  @SubscribeMessage('call:join')
  async handleCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; callerId?: number },
  ) {
    const receiverId = this.getUserId(client);
    if (!receiverId) return;

    let session: CallSessionState | null = null;
    if (data.sessionId) {
      session = this.validateSessionParticipant(data.sessionId, receiverId);
    } else if (data.callerId) {
      session = this.findSessionByHostAndParticipant(data.callerId, receiverId);
    }
    if (!session) return;

    const participant = session.participants.get(receiverId);
    if (!participant) return;
    if (participant.state === 'declined' || participant.state === 'missed') return;

    this.clearParticipantTimeout(session.sessionId, receiverId);

    participant.state = 'joined';
    participant.joinedAt = new Date();
    session.participants.set(receiverId, participant);

    if (participant.callLogId) {
      await this.callLogsService.markCallAnswered(participant.callLogId);
    }

    this.emitParticipantUpdate(session, receiverId, 'joined');

    this.sendToUser(receiverId, 'call:join', {
      sessionId: session.sessionId,
      roomId: session.roomId,
      joinedUserIds: this.getJoinedParticipants(session),
      callType: session.callType,
      hostId: session.hostId,
    });

    this.sendToUser(session.hostId, 'callAccepted', {
      receiverId,
      callLogId: participant.callLogId,
      sessionId: session.sessionId,
    });
  }

  // ================= REJECT =================
  @SubscribeMessage('rejectCall')
  async handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: number; sessionId?: string },
  ) {
    const receiverId = this.getUserId(client);
    if (!receiverId) return;

    let session: CallSessionState | null = null;
    if (data.sessionId) {
      session = this.validateSessionParticipant(data.sessionId, receiverId);
    } else {
      session = this.findSessionByHostAndParticipant(data.callerId, receiverId);
    }
    if (!session) return;

    const participant = session.participants.get(receiverId);
    if (!participant) return;

    this.clearParticipantTimeout(session.sessionId, receiverId);
    participant.state = 'declined';
    participant.leftAt = new Date();
    session.participants.set(receiverId, participant);

    if (participant.callLogId) {
      await this.callLogsService.markCallRejected(participant.callLogId);
    }

    this.emitParticipantUpdate(session, receiverId, 'declined');
    this.sendToUser(session.hostId, 'callRejected', {
      receiverId,
      sessionId: session.sessionId,
    });

    if (!this.hasNonHostActiveParticipant(session)) {
      await this.finishSession(session, session.hostId, 'no-participants');
    }
  }

  // ================= CANCEL =================
  @SubscribeMessage('cancelCall')
  async handleCancelCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId?: number; roomId?: number; sessionId?: string },
  ) {
    const callerId = this.getUserId(client);
    if (!callerId) return;

    const sessionsForCaller = Array.from(this.userSessions.get(callerId) ?? [])
      .map((sessionId) => this.activeSessions.get(sessionId))
      .filter((session): session is CallSessionState => Boolean(session))
      .filter((session) => session.hostId === callerId);

    if (sessionsForCaller.length === 0) return;

    for (const session of sessionsForCaller) {
      if (data.sessionId && data.sessionId !== session.sessionId) continue;
      if (data.roomId && data.roomId !== session.roomId) continue;

      const targets = data.targetUserId
        ? [data.targetUserId]
        : Array.from(session.participants.keys()).filter((id) => id !== callerId);

      for (const targetUserId of targets) {
        const participant = session.participants.get(targetUserId);
        if (!participant) continue;
        if (participant.state !== 'ringing' && participant.state !== 'invited')
          continue;

        this.clearParticipantTimeout(session.sessionId, targetUserId);
        participant.state = 'left';
        participant.leftAt = new Date();
        session.participants.set(targetUserId, participant);

        if (participant.callLogId) {
          await this.callLogsService.markCallCancelled(participant.callLogId);
        }

        this.emitParticipantUpdate(session, targetUserId, 'left', 'cancelled');
        this.sendToUser(targetUserId, 'callCancelled', {
          byUserId: callerId,
          sessionId: session.sessionId,
        });
      }

      if (!this.hasNonHostActiveParticipant(session)) {
        await this.finishSession(session, callerId, 'no-participants');
      }
    }
  }

  // ================= END =================
  @SubscribeMessage('endCall')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { sessionId?: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const sessionsForUser = Array.from(this.userSessions.get(userId) ?? [])
      .map((sessionId) => this.activeSessions.get(sessionId))
      .filter((session): session is CallSessionState => Boolean(session));

    for (const session of sessionsForUser) {
      if (data?.sessionId && data.sessionId !== session.sessionId) continue;

      if (session.hostId === userId) {
        await this.finishSession(session, userId, 'host-ended');
      } else {
        await this.leaveSession(session, userId, 'leave');
      }
    }
  }

  @SubscribeMessage('call:leave')
  async handleCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const session = this.validateSessionParticipant(data.sessionId, userId);
    if (!session) return;

    await this.leaveSession(session, userId, 'leave');
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const sessionsForUser = Array.from(this.userSessions.get(userId) ?? [])
      .map((sessionId) => this.activeSessions.get(sessionId))
      .filter((session): session is CallSessionState => Boolean(session));

    for (const session of sessionsForUser) {
      if (data.sessionId && data.sessionId !== session.sessionId) continue;
      if (session.hostId !== userId) continue;
      await this.finishSession(session, userId, 'host-ended');
    }
  }

  // ================= DISCONNECT =================
  async handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return;

    const sessions = Array.from(this.userSessions.get(userId) ?? [])
      .map((sessionId) => this.activeSessions.get(sessionId))
      .filter((session): session is CallSessionState => Boolean(session));

    for (const session of sessions) {
      const participant = session.participants.get(userId);
      if (!participant) continue;
      await this.leaveSession(session, userId, 'disconnect');
    }
  }

  // ================= WEBRTC SIGNALING =================

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId: number; sessionId: string; offer: any },
  ) {
    const fromUserId = this.getUserId(client);
    if (!fromUserId || !data.sessionId) return;

    const session = this.validateSessionParticipant(data.sessionId, fromUserId);
    if (!session) return;
    if (!this.canSignal(session, fromUserId, data.targetUserId)) return;

    this.sendToUser(data.targetUserId, 'offer', {
      fromUserId,
      sessionId: data.sessionId,
      offer: data.offer,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId: number; sessionId: string; answer: any },
  ) {
    const fromUserId = this.getUserId(client);
    if (!fromUserId || !data.sessionId) return;

    const session = this.validateSessionParticipant(data.sessionId, fromUserId);
    if (!session) return;
    if (!this.canSignal(session, fromUserId, data.targetUserId)) return;

    this.sendToUser(data.targetUserId, 'answer', {
      fromUserId,
      sessionId: data.sessionId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetUserId: number; sessionId: string; candidate: any },
  ) {
    const fromUserId = this.getUserId(client);
    if (!fromUserId || !data.sessionId) return;

    const session = this.validateSessionParticipant(data.sessionId, fromUserId);
    if (!session) return;
    if (!this.canSignal(session, fromUserId, data.targetUserId)) return;

    this.sendToUser(data.targetUserId, 'iceCandidate', {
      fromUserId,
      sessionId: data.sessionId,
      candidate: data.candidate,
    });
  }
}

type CallParticipantState =
  | 'invited'
  | 'ringing'
  | 'joined'
  | 'declined'
  | 'missed'
  | 'left';

type CallSessionParticipant = {
  userId: number;
  state: CallParticipantState;
  callLogId?: number;
  invitedAt: Date;
  joinedAt?: Date;
  leftAt?: Date;
};

type CallSessionState = {
  sessionId: string;
  roomId: number;
  hostId: number;
  callType: CallType;
  startedAt: Date;
  isGroupCall: boolean;
  participants: Map<number, CallSessionParticipant>;
};
