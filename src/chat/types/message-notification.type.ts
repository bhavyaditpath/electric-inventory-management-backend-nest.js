export type ReplyPreviewPayload = {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  kind: string;
  language: string;
  createdAt: Date;
  isRemoved: boolean;
};

export type ForwardPreviewPayload = {
  messageId: number | null;
  senderId: number | null;
  senderName: string;
  createdAt: Date | null;
  contentPreview: string;
  kind: string;
  language: string;
  isRemoved: boolean;
};

export type MessageNotificationPayload = {
  messageId: number;
  chatRoomId: number;
  senderId: number;
  senderName: string;
  content: string;
  kind: string;
  language: string;
  replyTo: ReplyPreviewPayload | null;
  isForwarded: boolean;
  forwardedFrom: ForwardPreviewPayload | null;
  createdAt: Date;
};
