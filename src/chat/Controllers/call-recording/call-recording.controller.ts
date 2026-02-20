import { Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Req, Res, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CallLogsService } from 'src/chat/callLogs.service';
import * as fs from 'fs';
import express from 'express';

@Controller('call-recording')
@UseGuards(JwtAuthGuard)
export class CallRecordingController {
    constructor(private readonly callLogsService: CallLogsService) { }

    private getUserId(req: express.Request): number {
        const user = (req as { user?: { id?: number } }).user;
        if (!user?.id) {
            throw new UnauthorizedException('User not authenticated');
        }
        return user.id;
    }
    @Post(':id/finalize')
    async finalizeRecording(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: express.Request
    ) {
        const userId = this.getUserId(req);
        const canAccess = await this.callLogsService.canUserAccessCallLog(id, userId);
        if (!canAccess) {
            throw new NotFoundException("Recording not found");
        }

        await this.callLogsService.finalizeRecordingUpload(id);
        return { ok: true };
    }


    @Post(':id/chunk')
    @UseInterceptors(FileInterceptor('file'))
    async uploadChunk(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: express.Request
    ) {
        const userId = this.getUserId(req);
        const canAccess = await this.callLogsService.canUserAccessCallLog(id, userId);
        if (!canAccess) {
            throw new NotFoundException("Recording not found");
        }

        const dir = `recordings/call_${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const chunkIndex = await this.callLogsService.incrementChunk(id);
        const chunkPath = `${dir}/chunk_${chunkIndex}.webm`;
        fs.writeFileSync(chunkPath, file.buffer);

        await this.callLogsService.notifyChunkUploaded(id);

        return { ok: true, chunkIndex };
    }

    @Get(':id/play')
    async streamRecording(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: express.Request,
        @Res() res: express.Response
    ) {
        const userId = this.getUserId(req);
        const canAccess = await this.callLogsService.canUserAccessCallLog(id, userId);
        if (!canAccess) {
            throw new NotFoundException("Recording not found");
        }

        const log = await this.callLogsService.getRecordingStream(id);

        if (!log || !log.hasRecording || !log.recordingPath)
            throw new NotFoundException("Recording not found");

        const filePath = log.recordingPath;

        if (!fs.existsSync(filePath))
            throw new NotFoundException("Recording file missing");

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader("Content-Type", log.recordingMimeType || "audio/webm");
        res.setHeader("Accept-Ranges", "bytes");

        if (!range) {
            res.setHeader("Content-Length", fileSize);
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            res.status(416).send("Requested range not satisfiable");
            return;
        }

        const chunkSize = (end - start) + 1;

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.setHeader("Content-Length", chunkSize);

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    }

    @Get(':id/download')
    async downloadRecording(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: express.Request,
        @Res() res: express.Response
    ) {
        const userId = this.getUserId(req);
        const canAccess = await this.callLogsService.canUserAccessCallLog(id, userId);
        if (!canAccess) {
            throw new NotFoundException("Recording not found");
        }

        const log = await this.callLogsService.getRecordingStream(id);

        if (!log || !log.hasRecording || !log.recordingPath)
            throw new NotFoundException("Recording not found");

        const filePath = log.recordingPath;

        if (!fs.existsSync(filePath))
            throw new NotFoundException("Recording file missing");

        res.setHeader("Content-Type", log.recordingMimeType || "audio/webm");
        res.setHeader("Content-Disposition", `attachment; filename="call_${id}.webm"`);

        fs.createReadStream(filePath).pipe(res);
    }
}
