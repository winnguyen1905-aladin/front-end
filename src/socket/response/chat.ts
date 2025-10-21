// ==============================
// Response Types (Server to Client) - Chat
// ==============================

/**
 * Base message structure returned by server
 */
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  messageType: 'text' | 'file' | 'image' | 'audio' | 'system';
  isEdited?: boolean;
  editedAt?: number;
  attachments?: Array<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  metadata?: Record<string, any>;
}

// ==============================
// Normal Chat Response Types
// ==============================

/**
 * Response after sending a message in normal chat
 */
export interface SendMessageResponse {
  success: boolean;
  message: Message;
  chatId: string;
}

/**
 * Server event: New message received in normal chat
 */
export interface NewMessageData {
  message: Message;
  chatId: string;
  recipientId: string;
}

/**
 * Response for chat history request
 */
export interface ChatHistoryResponse {
  messages: Message[];
  chatId: string;
  hasMore: boolean;
  total: number;
}

/**
 * Response for message edit request
 */
export interface EditMessageResponse {
  success: boolean;
  message: Message;
}

/**
 * Server event: Message was edited
 */
export interface MessageEditedData {
  messageId: string;
  chatId: string;
  newContent: string;
  editedAt: number;
}

/**
 * Response for message deletion
 */
export interface DeleteMessageResponse {
  success: boolean;
  messageId: string;
  deletedForEveryone: boolean;
}

/**
 * Server event: Message was deleted
 */
export interface MessageDeletedData {
  messageId: string;
  chatId: string;
  deletedForEveryone: boolean;
}

/**
 * Response for marking messages as read
 */
export interface MarkMessagesReadResponse {
  success: boolean;
  messageIds: string[];
  chatId: string;
}

/**
 * Server event: Messages marked as read by recipient
 */
export interface MessagesReadData {
  messageIds: string[];
  chatId: string;
  readBy: string;
  readAt: number;
}

/**
 * Server event: User is typing in normal chat
 */
export interface TypingIndicatorData {
  userId: string;
  userName: string;
  chatId: string;
  isTyping: boolean;
}

// ==============================
// Meeting/Group Chat Response Types
// ==============================

/**
 * Response after sending a message in group chat
 */
export interface SendGroupMessageResponse {
  success: boolean;
  message: GroupMessage;
}

/**
 * Extended message structure for group chat
 */
export interface GroupMessage extends Message {
  roomId: string;
  replyTo?: string; // messageId being replied to
  isPinned?: boolean;
  reactions?: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
}

/**
 * Server event: New message in group chat
 */
export interface NewGroupMessageData {
  message: GroupMessage;
  roomId: string;
}

/**
 * Response for group chat history
 */
export interface GroupChatHistoryResponse {
  messages: GroupMessage[];
  roomId: string;
  hasMore: boolean;
  total: number;
  pinnedMessages?: GroupMessage[];
}

/**
 * Response for pin/unpin message
 */
export interface PinGroupMessageResponse {
  success: boolean;
  messageId: string;
  isPinned: boolean;
}

/**
 * Server event: Message pinned/unpinned in group
 */
export interface GroupMessagePinnedData {
  messageId: string;
  roomId: string;
  isPinned: boolean;
  pinnedBy: string;
  pinnedAt?: number;
}

/**
 * Response for message reaction
 */
export interface GroupMessageReactionResponse {
  success: boolean;
  messageId: string;
  reactions: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
}

/**
 * Server event: Reaction added/removed in group chat
 */
export interface GroupMessageReactionData {
  messageId: string;
  roomId: string;
  userId: string;
  userName: string;
  emoji: string;
  action: 'add' | 'remove';
  reactions: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
}

/**
 * Server event: User is typing in group chat
 */
export interface GroupTypingIndicatorData {
  userId: string;
  userName: string;
  roomId: string;
  isTyping: boolean;
}

/**
 * Response for deleting group message
 */
export interface DeleteGroupMessageResponse {
  success: boolean;
  messageId: string;
}

/**
 * Server event: Message deleted in group chat
 */
export interface GroupMessageDeletedData {
  messageId: string;
  roomId: string;
  deletedBy: string;
}

/**
 * Response for editing group message
 */
export interface EditGroupMessageResponse {
  success: boolean;
  message: GroupMessage;
}

/**
 * Server event: Message edited in group chat
 */
export interface GroupMessageEditedData {
  messageId: string;
  roomId: string;
  newContent: string;
  editedBy: string;
  editedAt: number;
}

// ==============================
// General Chat Response Types
// ==============================

/**
 * Response for search messages
 */
export interface SearchMessagesResponse {
  messages: (Message | GroupMessage)[];
  total: number;
  query: string;
}

/**
 * Response for unread count
 */
export interface UnreadCountResponse {
  chats: Array<{
    chatId: string;
    unreadCount: number;
  }>;
  rooms: Array<{
    roomId: string;
    unreadCount: number;
  }>;
  totalUnread: number;
}

/**
 * Server event: Unread count updated
 */
export interface UnreadCountUpdatedData {
  chatId?: string;
  roomId?: string;
  unreadCount: number;
}

// ==============================
// Error Response Types
// ==============================

/**
 * Chat error response
 */
export interface ChatErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// ==============================
// Global Chat Response Types
// ==============================

/**
 * Global chat message structure
 */
export interface GlobalMessage extends Message {
  channelId: string;
}

/**
 * Response after sending a message in global chat
 */
export interface SendGlobalMessageResponse {
  success: boolean;
  message: GlobalMessage;
}

/**
 * Server event: New message in global chat
 */
export interface NewGlobalMessageData {
  message: GlobalMessage;
}

/**
 * Response for global chat history
 */
export interface GlobalChatHistoryResponse {
  messages: GlobalMessage[];
  hasMore: boolean;
  total: number;
}

/**
 * Server event: User is typing in global chat
 */
export interface GlobalTypingIndicatorData {
  userId: string;
  userName: string;
  isTyping: boolean;
}

