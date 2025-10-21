// ==============================
// Request Types (Client to Server) - Chat
// ==============================

/**
 * Base message interface for all chat messages
 */
export interface BaseMessage {
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

// ==============================
// Normal Chat Request Types
// ==============================

/**
 * Request to send a message in normal/direct chat
 */
export interface SendMessageRequest extends BaseMessage {
  recipientId: string;
  messageType?: 'text' | 'file' | 'image' | 'audio';
  attachments?: Array<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
}

/**
 * Request to mark messages as read in normal chat
 */
export interface MarkMessagesReadRequest {
  messageIds: string[];
  chatId?: string;
}

/**
 * Request to edit a sent message in normal chat
 */
export interface EditMessageRequest {
  messageId: string;
  newContent: string;
  timestamp: number;
}

/**
 * Request to delete a message in normal chat
 */
export interface DeleteMessageRequest {
  messageId: string;
  deleteForEveryone?: boolean;
}

/**
 * Request to get chat history for normal chat
 */
export interface GetChatHistoryRequest {
  chatId: string;
  limit?: number;
  offset?: number;
  before?: number; // timestamp
}

/**
 * Request to indicate user is typing in normal chat
 */
export interface TypingIndicatorRequest {
  recipientId: string;
  isTyping: boolean;
}

// ==============================
// Meeting/Group Chat Request Types
// ==============================

/**
 * Request to send a message in meeting/group chat
 */
export interface SendGroupMessageRequest extends BaseMessage {
  roomId: string;
  messageType?: 'text' | 'file' | 'image' | 'audio' | 'system';
  attachments?: Array<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  replyTo?: string; // messageId being replied to
}

/**
 * Request to get group chat history
 */
export interface GetGroupChatHistoryRequest {
  roomId: string;
  limit?: number;
  offset?: number;
  before?: number; // timestamp
}

/**
 * Request to pin/unpin a message in group chat
 */
export interface PinGroupMessageRequest {
  roomId: string;
  messageId: string;
  pin: boolean; // true to pin, false to unpin
}

/**
 * Request to react to a message in group chat
 */
export interface GroupMessageReactionRequest {
  roomId: string;
  messageId: string;
  emoji: string;
  action: 'add' | 'remove';
}

/**
 * Request to indicate user is typing in group chat
 */
export interface GroupTypingIndicatorRequest {
  roomId: string;
  isTyping: boolean;
}

/**
 * Request to delete a message in group chat
 */
export interface DeleteGroupMessageRequest {
  roomId: string;
  messageId: string;
}

/**
 * Request to edit a message in group chat
 */
export interface EditGroupMessageRequest {
  roomId: string;
  messageId: string;
  newContent: string;
  timestamp: number;
}

// ==============================
// General Chat Request Types
// ==============================

/**
 * Request to search messages
 */
export interface SearchMessagesRequest {
  query: string;
  chatId?: string;
  roomId?: string;
  limit?: number;
  messageType?: 'text' | 'file' | 'image' | 'audio';
}

/**
 * Request to get unread message count
 */
export interface GetUnreadCountRequest {
  chatIds?: string[];
  roomIds?: string[];
}

// ==============================
// Global Chat Request Types
// ==============================

/**
 * Request to send a message in global chat
 */
export interface SendGlobalMessageRequest extends BaseMessage {
  messageType?: 'text' | 'file' | 'image' | 'audio';
}

/**
 * Request to get global chat history
 */
export interface GetGlobalChatHistoryRequest {
  limit?: number;
  offset?: number;
  before?: number; // timestamp
}

/**
 * Request to indicate user is typing in global chat
 */
export interface GlobalTypingIndicatorRequest {
  isTyping: boolean;
}

