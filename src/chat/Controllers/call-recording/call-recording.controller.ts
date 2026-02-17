import { Controller, Param, ParseIntPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CallLogsService } from 'src/chat/callLogs.service';
import * as fs from 'fs';

@Controller('call-recording')
@UseGuards(JwtAuthGuard)
export class CallRecordingController {
    constructor(private readonly callLogsService: CallLogsService) { }

    @Post(':id/chunk')
    @UseInterceptors(FileInterceptor('file'))
    async uploadChunk(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File
    ) {
        const dir = `recordings/call_${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const chunkIndex = await this.callLogsService.incrementChunk(id);

        const path = `${dir}/chunk_${chunkIndex}.webm`;
        fs.writeFileSync(path, file.buffer);


        return { ok: true };
    }

}
