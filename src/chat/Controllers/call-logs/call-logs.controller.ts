import {
    Controller,
    Get,
    Param,
    Req,
    UseGuards,
    ParseIntPipe,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CallLogsService } from 'src/chat/callLogs.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('call-logs')
@UseGuards(JwtAuthGuard)
export class CallLogsController {
    constructor(private readonly callLogsService: CallLogsService) { }

    private getUserId(req: Request): number {
        const user = (req as { user?: { id?: number } }).user;
        if (!user?.id) {
            throw new UnauthorizedException('User not authenticated');
        }
        return user.id;
    }

    @Get('history')
    async getCallHistory(@Req() req: Request) {
        const userId = this.getUserId(req);
        return this.callLogsService.getCallHistory(userId);
    }

    @Get('missed')
    async getMissedCalls(@Req() req: Request) {
        const userId = this.getUserId(req);
        return this.callLogsService.getMissedCalls(userId);
    }

    @Get(':roomId')
    async getRoomCalls(
        @Param('roomId', ParseIntPipe) roomId: number,
        @Req() req: Request,
    ) {
        const userId = this.getUserId(req);
        return this.callLogsService.getRoomCallHistory(roomId, userId);
    }
}
