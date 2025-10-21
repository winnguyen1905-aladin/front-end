import { SocketClient } from '../socket-client';
import type {
  NewMessageData,
  MessageEditedData,
  MessageDeletedData,
  MessagesReadData,
  TypingIndicatorData,
  NewGroupMessageData,
  GroupMessagePinnedData,
  GroupMessageReactionData,
  GroupTypingIndicatorData,
  GroupMessageDeletedData,
  GroupMessageEditedData,
  UnreadCountUpdatedData,
  NewGlobalMessageData,
  GlobalTypingIndicatorData,
} from '../response/chat';

// ==============================
// Chat Event Handlers Interface
// ==============================

export interface ChatEventHandlers {
  // Normal Chat Events
  onNewMessage?: (data: NewMessageData) => void;
  onMessageEdited?: (data: MessageEditedData) => void;
  onMessageDeleted?: (data: MessageDeletedData) => void;
  onMessagesRead?: (data: MessagesReadData) => void;
  onTypingIndicator?: (data: TypingIndicatorData) => void;
  
  // Group Chat Events
  onNewGroupMessage?: (data: NewGroupMessageData) => void;
  onGroupMessageEdited?: (data: GroupMessageEditedData) => void;
  onGroupMessageDeleted?: (data: GroupMessageDeletedData) => void;
  onGroupMessagePinned?: (data: GroupMessagePinnedData) => void;
  onGroupMessageReaction?: (data: GroupMessageReactionData) => void;
  onGroupTypingIndicator?: (data: GroupTypingIndicatorData) => void;
  
  // Global Chat Events
  onNewGlobalMessage?: (data: NewGlobalMessageData) => void;
  onGlobalTypingIndicator?: (data: GlobalTypingIndicatorData) => void;
  
  // General Events
  onUnreadCountUpdated?: (data: UnreadCountUpdatedData) => void;
  onChatError?: (error: { code: string; message: string; details?: any }) => void;
}

// ==============================
// Chat Event Manager
// ==============================

export class ChatEventManager {
  private socketClient: SocketClient;
  private handlers: ChatEventHandlers;

  constructor(socketClient: SocketClient, handlers: ChatEventHandlers = {}) {
    this.socketClient = socketClient;
    this.handlers = handlers;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // ==============================
    // Normal Chat Event Listeners
    // ==============================

    this.socketClient.on('chat:newMessage', (data: NewMessageData) => {
      this.log('New message received:', data);
      if (this.handlers.onNewMessage) {
        this.handlers.onNewMessage(data);
      }
    });
    
    this.socketClient.on('chat:messageEdited', (data: MessageEditedData) => {
      this.log('Message edited:', data);
      if (this.handlers.onMessageEdited) {
        this.handlers.onMessageEdited(data);
      }
    });

    this.socketClient.on('chat:messageDeleted', (data: MessageDeletedData) => {
      this.log('Message deleted:', data);
      if (this.handlers.onMessageDeleted) {
        this.handlers.onMessageDeleted(data);
      }
    });

    this.socketClient.on('chat:messagesRead', (data: MessagesReadData) => {
      this.log('Messages read:', data);
      if (this.handlers.onMessagesRead) {
        this.handlers.onMessagesRead(data);
      }
    });

    this.socketClient.on('chat:typing', (data: TypingIndicatorData) => {
      this.log('Typing indicator:', data);
      if (this.handlers.onTypingIndicator) {
        this.handlers.onTypingIndicator(data);
      }
    });

    // ==============================
    // Group Chat Event Listeners
    // ==============================

    this.socketClient.on('chat:groupNewMessage', (data: NewGroupMessageData) => {
      this.log('New group message received:', data);
      if (this.handlers.onNewGroupMessage) {
        this.handlers.onNewGroupMessage(data);
      }
    });

    this.socketClient.on('chat:groupMessageEdited', (data: GroupMessageEditedData) => {
      this.log('Group message edited:', data);
      if (this.handlers.onGroupMessageEdited) {
        this.handlers.onGroupMessageEdited(data);
      }
    });

    this.socketClient.on('chat:groupMessageDeleted', (data: GroupMessageDeletedData) => {
      this.log('Group message deleted:', data);
      if (this.handlers.onGroupMessageDeleted) {
        this.handlers.onGroupMessageDeleted(data);
      }
    });

    this.socketClient.on('chat:groupMessagePinned', (data: GroupMessagePinnedData) => {
      this.log('Group message pinned/unpinned:', data);
      if (this.handlers.onGroupMessagePinned) {
        this.handlers.onGroupMessagePinned(data);
      }
    });

    this.socketClient.on('chat:groupReaction', (data: GroupMessageReactionData) => {
      this.log('Group message reaction:', data);
      if (this.handlers.onGroupMessageReaction) {
        this.handlers.onGroupMessageReaction(data);
      }
    });

    this.socketClient.on('chat:groupTyping', (data: GroupTypingIndicatorData) => {
      this.log('Group typing indicator:', data);
      if (this.handlers.onGroupTypingIndicator) {
        this.handlers.onGroupTypingIndicator(data);
      }
    });

    // ==============================
    // Global Chat Event Listeners
    // ==============================

    this.socketClient.on('chat:globalNewMessage', (data: NewGlobalMessageData) => {
      this.log('New global message received:', data);
      if (this.handlers.onNewGlobalMessage) {
        this.handlers.onNewGlobalMessage(data);
      }
    });

    this.socketClient.on('chat:globalTyping', (data: GlobalTypingIndicatorData) => {
      this.log('Global typing indicator:', data);
      if (this.handlers.onGlobalTypingIndicator) {
        this.handlers.onGlobalTypingIndicator(data);
      }
    });

    // ==============================
    // General Event Listeners
    // ==============================

    this.socketClient.on('chat:unreadCountUpdated', (data: UnreadCountUpdatedData) => {
      this.log('Unread count updated:', data);
      if (this.handlers.onUnreadCountUpdated) {
        this.handlers.onUnreadCountUpdated(data);
      }
    });

    this.socketClient.on('chat:error', (error: { code: string; message: string; details?: any }) => {
      this.error('Chat error:', error);
      if (this.handlers.onChatError) {
        this.handlers.onChatError(error);
      }
    });
  }

  /**
   * Update event handlers dynamically
   */
  updateHandlers(handlers: Partial<ChatEventHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Remove all event listeners
   */
  destroy(): void {
    this.socketClient.removeAllListeners('chat:newMessage');
    this.socketClient.removeAllListeners('chat:messageEdited');
    this.socketClient.removeAllListeners('chat:messageDeleted');
    this.socketClient.removeAllListeners('chat:messagesRead');
    this.socketClient.removeAllListeners('chat:typing');
    this.socketClient.removeAllListeners('chat:groupNewMessage');
    this.socketClient.removeAllListeners('chat:groupMessageEdited');
    this.socketClient.removeAllListeners('chat:groupMessageDeleted');
    this.socketClient.removeAllListeners('chat:groupMessagePinned');
    this.socketClient.removeAllListeners('chat:groupReaction');
    this.socketClient.removeAllListeners('chat:groupTyping');
    this.socketClient.removeAllListeners('chat:globalNewMessage');
    this.socketClient.removeAllListeners('chat:globalTyping');
    this.socketClient.removeAllListeners('chat:unreadCountUpdated');
    this.socketClient.removeAllListeners('chat:error');
  }

  private log(...args: any[]): void {
    console.log('[ChatEvents]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[ChatEvents]', ...args);
  }
}

