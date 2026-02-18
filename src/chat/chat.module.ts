import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatAttachment } from './entities/chat-attachment.entity';
import { ChatRoomParticipant } from './entities/chat-room-participant.entity';
import { User } from '../user/entities/user.entity';
import { ChatRoomPin } from './entities/chat-room-pin.entity';
import { ChatMessageDeletion } from './entities/chat-message-deletion.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { ChatService } from './chat.service';
import { ChatController } from './Controllers/chat.controller';
import { AuthModule } from '../auth/auth.module';
import { CallLog } from './entities/call-log.entity';
import { CallGateway } from './Gateways/call/call.gateway';
import { ChatGateway } from './Gateways/chat/chat.gateway';
import { CallLogsController } from './Controllers/call-logs/call-logs.controller';
import { CallLogsService } from './callLogs.service';
import { CallRecordingController } from './Controllers/call-recording/call-recording.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      ChatMessage,
      ChatAttachment,
      ChatMessageDeletion,
      ChatMessageReaction,
      ChatRoomParticipant,
      ChatRoomPin,
      User,
      CallLog,
    ]),
    AuthModule,
  ],
  controllers: [ChatController, CallLogsController, CallRecordingController],
  providers: [ChatService, CallLogsService, ChatGateway, CallGateway],
  exports: [ChatService, CallLogsService, ChatGateway, CallGateway],
})
export class ChatModule {}
