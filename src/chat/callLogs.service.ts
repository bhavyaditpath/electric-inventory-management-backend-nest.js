import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CallLog } from "./entities/call-log.entity";
import { In, Repository } from "typeorm";
import { User } from "src/user/entities/user.entity";
import { CallLogsStatus } from "src/shared/enums/callLogsStatus.enum";
import { CallType } from "src/shared/enums/callType.enum";
import * as fs from 'fs';
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execPromise = promisify(exec);
@Injectable()
export class CallLogsService {
      private processingTimers = new Map<number, NodeJS.Timeout>();
  private processingLocks = new Set<number>();
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

        if (!log.recordingProcessing) {
            log.recordingProcessing = true;
        }

        await this.callLogRepository.save(log);

        this.scheduleRecordingProcessing(callLogId, 5000);

        return log;
    }

    async notifyChunkUploaded(callLogId: number) {
        const log = await this.callLogRepository.findOne({
            where: { id: callLogId },
            select: ["id", "endedAt", "recordingProcessing"],
        });
        if (!log?.endedAt || !log.recordingProcessing) return;

        // Debounce processing while chunks are still arriving.
        this.scheduleRecordingProcessing(callLogId, 2500);
    }

    async finalizeRecordingUpload(callLogId: number) {
        const log = await this.callLogRepository.findOne({
            where: { id: callLogId },
            select: ["id", "recordingProcessing"],
        });
        if (!log) return;

        if (!log.recordingProcessing) {
            await this.callLogRepository.update(callLogId, { recordingProcessing: true });
        }

        // Finalize quickly after explicit client finalize call.
        this.scheduleRecordingProcessing(callLogId, 1000);
    }

    private scheduleRecordingProcessing(callLogId: number, delayMs: number) {
        const existing = this.processingTimers.get(callLogId);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            void this.runProcessing(callLogId);
        }, delayMs);

        this.processingTimers.set(callLogId, timer);
    }

    private async runProcessing(callLogId: number) {
        const timer = this.processingTimers.get(callLogId);
        if (timer) {
            clearTimeout(timer);
            this.processingTimers.delete(callLogId);
        }

        if (this.processingLocks.has(callLogId)) return;
        this.processingLocks.add(callLogId);

        try {
            await this.processRecording(callLogId);
        } finally {
            this.processingLocks.delete(callLogId);
        }
    }

    private sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private listChunkFiles(dir: string): string[] {
        if (!fs.existsSync(dir)) return [];
        return fs
            .readdirSync(dir)
            .filter((f) => /^chunk_\d+\.webm$/i.test(f))
            .sort((a, b) => {
                const ai = Number(a.match(/^chunk_(\d+)\.webm$/i)?.[1] ?? 0);
                const bi = Number(b.match(/^chunk_(\d+)\.webm$/i)?.[1] ?? 0);
                return ai - bi;
            });
    }

    private getChunkSignature(dir: string, files: string[]) {
        return files
            .map((f) => {
                const size = fs.statSync(path.join(dir, f)).size;
                return `${f}:${size}`;
            })
            .join("|");
    }

    private async waitForStableChunks(
        dir: string,
        maxAttempts = 10,
        intervalMs = 700
    ): Promise<string[]> {
        let lastSignature = "";
        let stableRounds = 0;

        for (let i = 0; i < maxAttempts; i++) {
            const files = this.listChunkFiles(dir);
            if (!files.length) {
                await this.sleep(intervalMs);
                continue;
            }

            const signature = this.getChunkSignature(dir, files);

            if (signature === lastSignature) {
                stableRounds += 1;
                if (stableRounds >= 2) return files;
            } else {
                stableRounds = 0;
                lastSignature = signature;
            }

            await this.sleep(intervalMs);
        }

        return this.listChunkFiles(dir);
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
        const withNames = await this.attachUserNames(logs);
        return this.attachRecordingUrls(withNames);
    }

    async getMissedCalls(userId: number) {
        const logs = await this.callLogRepository.find({
            where: {
                receiverId: userId,
                status: CallLogsStatus.MISSED,
            },
            order: { createdAt: 'DESC' },
        });
        const withNames = await this.attachUserNames(logs);
        return this.attachRecordingUrls(withNames);
    }

    async getRoomCallHistory(roomId: number, userId: number) {
        const logs = await this.callLogRepository.find({
            where: [
                { roomId, callerId: userId },
                { roomId, receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
        const withNames = await this.attachUserNames(logs);
        return this.attachRecordingUrls(withNames);
    }

    private attachRecordingUrls(logs: any[]) {
        return logs.map((log) => {
            const hasRecording = Boolean(log.hasRecording);
            return {
                ...log,
                recordingPlayUrl: hasRecording ? `/call-recording/${log.id}/play` : null,
                recordingDownloadUrl: hasRecording ? `/call-recording/${log.id}/download` : null,
            };
        });
    }

    async canUserAccessCallLog(callLogId: number, userId: number) {
        return this.callLogRepository.exist({
            where: [
                { id: callLogId, callerId: userId },
                { id: callLogId, receiverId: userId },
            ],
        });
    }

    async incrementChunk(callLogId: number): Promise<number> {
        await this.callLogRepository.increment({ id: callLogId }, "recordingChunks", 1);

        const updated = await this.callLogRepository.findOne({
            where: { id: callLogId },
            select: ["recordingChunks"],
        });

        return updated?.recordingChunks ?? 1;
    }


    async processRecording(callLogId: number) {
        const dir = `recordings/call_${callLogId}`;
        if (!fs.existsSync(dir)) {
            await this.callLogRepository.update(callLogId, { recordingProcessing: false });
            return;
        }

        const files = await this.waitForStableChunks(dir);
        if (!files.length) {
            await this.callLogRepository.update(callLogId, {
                recordingProcessing: false,
                hasRecording: false,
                recordingPath: null,
                recordingSize: null,
                recordingMimeType: null,
            });
            return;
        }

        const listFile = path.join(dir, "list.txt");
        const output = path.join(dir, "final.webm");

        const listContent = files
            .map((f) => `file '${f}'`)
            .join("\n");

        fs.writeFileSync(listFile, listContent, { encoding: "utf-8" });

        try {
            await execPromise(
                `ffmpeg -loglevel error -f concat -safe 0 -i "${listFile}" -vn -c:a libopus -b:a 64k -y "${output}"`
            );

            if (!fs.existsSync(output)) {
                throw new Error("Merged recording not created");
            }

            const stats = fs.statSync(output);
            if (!stats.size) {
                throw new Error("Merged recording is empty");
            }

            await this.callLogRepository.update(callLogId, {
                recordingPath: output,
                recordingProcessing: false,
                hasRecording: true,
                recordingSize: stats.size,
                recordingMimeType: "audio/webm",
            });
        } catch (error) {
            console.error(`Failed to process recording for callLogId=${callLogId}:`, error);
            await this.callLogRepository.update(callLogId, {
                recordingProcessing: false,
                hasRecording: false,
            });
        }
    }


    getRecordingStream(callLogId: number) {
        return this.callLogRepository.findOne({
            where: { id: callLogId },
            select: ["id", "recordingPath", "hasRecording", "recordingMimeType", "recordingSize"]
        });
    }


}
