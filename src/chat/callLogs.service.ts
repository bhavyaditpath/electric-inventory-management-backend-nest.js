import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CallLog } from "./entities/call-log.entity";
import { In, Repository } from "typeorm";
import { User } from "src/user/entities/user.entity";
import { CallLogsStatus } from "src/shared/enums/callLogsStatus.enum";
import { CallType } from "src/shared/enums/callType.enum";

@Injectable()
export class CallLogsService {
    constructor(
        @InjectRepository(CallLog)
        private callLogRepository: Repository<CallLog>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async createOutgoingCallLog(
        roomId: number,
        callerId: number,
        receiverId: number,
        callType: CallType = CallType.AUDIO,
    ) {
        const log = this.callLogRepository.create({
            roomId,
            callerId,
            receiverId,
            status: CallLogsStatus.MISSED,
            callType,
            startedAt: null,
            endedAt: null,
            duration: null,
            createdBy: callerId,
        });

        return this.callLogRepository.save(log);
    }

    async markCallAnswered(callLogId: number) {
        const log = await this.callLogRepository.findOne({ where: { id: callLogId } });
        if (!log) return;

        log.status = CallLogsStatus.ANSWERED;
        log.startedAt = new Date();
        log.updatedAt = new Date();

        return this.callLogRepository.save(log);
    }

    async markCallRejected(callLogId: number) {
        const log = await this.callLogRepository.findOne({ where: { id: callLogId } });
        if (!log) return;

        log.status = CallLogsStatus.REJECTED;
        log.endedAt = new Date();
        log.duration = 0;

        return this.callLogRepository.save(log);
    }

    async markCallCancelled(callLogId: number) {
        const log = await this.callLogRepository.findOne({ where: { id: callLogId } });
        if (!log) return;

        log.status = CallLogsStatus.CANCELLED;
        log.endedAt = new Date();
        log.duration = 0;

        return this.callLogRepository.save(log);
    }

    async markCallMissed(callLogId: number) {
        const log = await this.callLogRepository.findOne({ where: { id: callLogId } });
        if (!log) return;

        log.status = CallLogsStatus.MISSED;
        log.endedAt = new Date();
        log.duration = 0;

        return this.callLogRepository.save(log);
    }

    async finishCall(callLogId: number) {
        const log = await this.callLogRepository.findOne({ where: { id: callLogId } });
        if (!log) return;

        const endTime = new Date();
        log.endedAt = endTime;

        if (log.startedAt) {
            log.duration = Math.floor((endTime.getTime() - log.startedAt.getTime()) / 1000);
        } else {
            log.duration = 0;
        }

        return this.callLogRepository.save(log);
    }

    private getDisplayName(user?: User | null) {
        if (!user) return null;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        if (fullName) return fullName;
        if (user.username) return user.username;
        if (user.email) return user.email;
        return null;
    }

    private async attachUserNames(logs: CallLog[]) {
        const ids = new Set<number>();
        for (const log of logs) {
            if (log.callerId) ids.add(log.callerId);
            if (log.receiverId) ids.add(log.receiverId);
        }

        if (ids.size === 0) return logs;

        const users = await this.userRepository.find({
            where: { id: In(Array.from(ids)) },
        });

        const userMap = new Map<number, User>();
        for (const user of users) {
            userMap.set(user.id, user);
        }

        return logs.map((log) => {
            const { callerId, receiverId, ...rest } = log as CallLog & {
                callerId: number;
                receiverId: number;
            };

            return {
                ...rest,
                callerName: this.getDisplayName(userMap.get(callerId)),
                receiverName: this.getDisplayName(userMap.get(receiverId)),
            };
        });
    }

    async getUserDisplayNameById(userId: number) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        return this.getDisplayName(user);
    }

    async getCallHistory(userId: number) {
        const logs = await this.callLogRepository.find({
            where: [
                { callerId: userId },
                { receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
        return this.attachUserNames(logs);
    }

    async getMissedCalls(userId: number) {
        const logs = await this.callLogRepository.find({
            where: {
                receiverId: userId,
                status: CallLogsStatus.MISSED,
            },
            order: { createdAt: 'DESC' },
        });
        return this.attachUserNames(logs);
    }

    async getRoomCallHistory(roomId: number, userId: number) {
        const logs = await this.callLogRepository.find({
            where: [
                { roomId, callerId: userId },
                { roomId, receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
        return this.attachUserNames(logs);
    }

}
