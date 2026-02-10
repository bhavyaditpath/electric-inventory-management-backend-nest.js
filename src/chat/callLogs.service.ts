import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CallLog } from "./entities/call-log.entity";
import { Repository } from "typeorm";
import { User } from "src/user/entities/user.entity";
import { CallLogsStatus } from "src/shared/enums/callLogsStatus.enum";

@Injectable()
export class CallLogsService {
    constructor(
        @InjectRepository(CallLog)
        private callLogRepository: Repository<CallLog>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async createOutgoingCallLog(roomId: number, callerId: number, receiverId: number) {
        const log = this.callLogRepository.create({
            roomId,
            callerId,
            receiverId,
            status: CallLogsStatus.MISSED,
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

    async getCallHistory(userId: number) {
        return this.callLogRepository.find({
            where: [
                { callerId: userId },
                { receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
    }

    async getMissedCalls(userId: number) {
        return this.callLogRepository.find({
            where: {
                receiverId: userId,
                status: CallLogsStatus.MISSED,
            },
            order: { createdAt: 'DESC' },
        });
    }

    async getRoomCallHistory(roomId: number, userId: number) {
        return this.callLogRepository.find({
            where: [
                { roomId, callerId: userId },
                { roomId, receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
    }

}