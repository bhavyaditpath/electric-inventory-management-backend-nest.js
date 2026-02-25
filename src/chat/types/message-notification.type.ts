export type ReplyPreviewPayload = {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: Date;
  isRemoved: boolean;
};

export type MessageNotificationPayload = {
  messageId: number;
  chatRoomId: number;
  senderId: number;
  senderName: string;
  content: string;
  replyTo: ReplyPreviewPayload | null;
  createdAt: Date;
};
