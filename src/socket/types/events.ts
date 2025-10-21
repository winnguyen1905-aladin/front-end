// ==============================
// Re-export Request and Response Types
// ==============================

export * from '../request/call';
export * from '../response/call';
export * from '../request/chat';
export * from '../response/chat';

// Import types for use in interfaces below
import type {
  JoinRoomRequest,
  AudioChangeRequest,
  ConsumeRequest,
  CreateProducerTransportRequest,
  CreateConsumerTransportRequest,
  CreateProducerRequest,
  CreateConsumerRequest,
  ConnectProducerTransportRequest,
  ConnectConsumerTransportRequest
} from '../request/call';

import type {
  JoinRoomResponse,
  ConsumeResponse,
  ActiveSpeakersUpdate,
  NewProducersData,
  ProducerClosedData,
  UserLeftData,
  TransportResponse,
  ProducerResponse,
  ConsumerResponse
} from '../response/call';

import type {
  SendMessageRequest,
  MarkMessagesReadRequest,
  EditMessageRequest,
  DeleteMessageRequest,
  GetChatHistoryRequest,
  TypingIndicatorRequest,
  SendGroupMessageRequest,
  GetGroupChatHistoryRequest,
  PinGroupMessageRequest,
  GroupMessageReactionRequest,
  GroupTypingIndicatorRequest,
  DeleteGroupMessageRequest,
  EditGroupMessageRequest,
  SearchMessagesRequest,
  GetUnreadCountRequest,
  SendGlobalMessageRequest,
  GetGlobalChatHistoryRequest,
  GlobalTypingIndicatorRequest
} from '../request/chat';

import type {
  SendMessageResponse,
  NewMessageData,
  ChatHistoryResponse,
  EditMessageResponse,
  MessageEditedData,
  DeleteMessageResponse,
  MessageDeletedData,
  MarkMessagesReadResponse,
  MessagesReadData,
  TypingIndicatorData,
  SendGroupMessageResponse,
  NewGroupMessageData,
  GroupChatHistoryResponse,
  PinGroupMessageResponse,
  GroupMessagePinnedData,
  GroupMessageReactionResponse,
  GroupMessageReactionData,
  GroupTypingIndicatorData,
  DeleteGroupMessageResponse,
  GroupMessageDeletedData,
  EditGroupMessageResponse,
  GroupMessageEditedData,
  SearchMessagesResponse,
  UnreadCountResponse,
  UnreadCountUpdatedData,
  SendGlobalMessageResponse,
  NewGlobalMessageData,
  GlobalChatHistoryResponse,
  GlobalTypingIndicatorData
} from '../response/chat';

// ==============================
// Socket Event Map
// ==============================

export interface ServerToClientEvents {
  // Connection events
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  
  // Room events
  updateActiveSpeakers: (data: string[] | ActiveSpeakersUpdate) => void;
  newProducersToConsume: (data: NewProducersData) => void;
  producerClosed: (data: ProducerClosedData) => void;
  userLeft: (data: UserLeftData) => void;
  
  // Room status
  roomFull: () => void;
  roomClosed: () => void;
  
  // Normal Chat events (Server to Client)
  'chat:newMessage': (data: NewMessageData) => void;
  'chat:messageEdited': (data: MessageEditedData) => void;
  'chat:messageDeleted': (data: MessageDeletedData) => void;
  'chat:messagesRead': (data: MessagesReadData) => void;
  'chat:typing': (data: TypingIndicatorData) => void;
  
  // Group Chat events (Server to Client)
  'chat:groupNewMessage': (data: NewGroupMessageData) => void;
  'chat:groupMessageEdited': (data: GroupMessageEditedData) => void;
  'chat:groupMessageDeleted': (data: GroupMessageDeletedData) => void;
  'chat:groupMessagePinned': (data: GroupMessagePinnedData) => void;
  'chat:groupReaction': (data: GroupMessageReactionData) => void;
  'chat:groupTyping': (data: GroupTypingIndicatorData) => void;
  
  // General Chat events
  'chat:unreadCountUpdated': (data: UnreadCountUpdatedData) => void;
  'chat:error': (error: { code: string; message: string; details?: any }) => void;
  
  // Global Chat events (Server to Client)
  'chat:globalNewMessage': (data: NewGlobalMessageData) => void;
  'chat:globalTyping': (data: GlobalTypingIndicatorData) => void;
}

export interface ClientToServerEvents {
  // Room management
  joinRoom: (data: JoinRoomRequest) => Promise<JoinRoomResponse>;
  leaveRoom: () => void;
  
  // Media control
  audioChange: (data: AudioChangeRequest) => void;
  videoChange: (action: 'enable' | 'disable') => void;
  
  // Transport and producer management
  createProducerTransport: (data: CreateProducerTransportRequest) => Promise<TransportResponse>;
  createConsumerTransport: (data: CreateConsumerTransportRequest) => Promise<TransportResponse>;
  createProducer: (data: CreateProducerRequest) => Promise<ProducerResponse>;
  createConsumer: (data: CreateConsumerRequest) => Promise<ConsumerResponse>;
  
  // WebRTC signaling
  connectProducerTransport: (data: ConnectProducerTransportRequest) => Promise<void>;
  connectConsumerTransport: (data: ConnectConsumerTransportRequest) => Promise<void>;
  
  // Consume request
  requestTransport: (data: ConsumeRequest) => Promise<ConsumeResponse>;
  
  // Normal Chat events (Client to Server)
  'chat:sendMessage': (data: SendMessageRequest) => Promise<SendMessageResponse>;
  'chat:editMessage': (data: EditMessageRequest) => Promise<EditMessageResponse>;
  'chat:deleteMessage': (data: DeleteMessageRequest) => Promise<DeleteMessageResponse>;
  'chat:markRead': (data: MarkMessagesReadRequest) => Promise<MarkMessagesReadResponse>;
  'chat:typing': (data: TypingIndicatorRequest) => void;
  'chat:getHistory': (data: GetChatHistoryRequest) => Promise<ChatHistoryResponse>;
  
  // Group Chat events (Client to Server)
  'chat:sendGroupMessage': (data: SendGroupMessageRequest) => Promise<SendGroupMessageResponse>;
  'chat:editGroupMessage': (data: EditGroupMessageRequest) => Promise<EditGroupMessageResponse>;
  'chat:deleteGroupMessage': (data: DeleteGroupMessageRequest) => Promise<DeleteGroupMessageResponse>;
  'chat:pinGroupMessage': (data: PinGroupMessageRequest) => Promise<PinGroupMessageResponse>;
  'chat:groupReaction': (data: GroupMessageReactionRequest) => Promise<GroupMessageReactionResponse>;
  'chat:groupTyping': (data: GroupTypingIndicatorRequest) => void;
  'chat:getGroupHistory': (data: GetGroupChatHistoryRequest) => Promise<GroupChatHistoryResponse>;
  
  // General Chat events
  'chat:searchMessages': (data: SearchMessagesRequest) => Promise<SearchMessagesResponse>;
  'chat:getUnreadCount': (data: GetUnreadCountRequest) => Promise<UnreadCountResponse>;
  
  // Global Chat events (Client to Server)
  'chat:sendGlobalMessage': (data: SendGlobalMessageRequest) => Promise<SendGlobalMessageResponse>;
  'chat:globalTyping': (data: GlobalTypingIndicatorRequest) => void;
  'chat:getGlobalHistory': (data: GetGlobalChatHistoryRequest) => Promise<GlobalChatHistoryResponse>;
}

// ==============================
// Socket Error Types
// ==============================

export interface SocketError {
  message: string;
  code?: string;
  details?: any;
}

export interface SocketTimeoutError extends SocketError {
  timeout: number;
  event: string;
}

// ==============================
// Event Handler Types
// ==============================

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export type SocketEventHandlers = {
  [K in keyof ServerToClientEvents]: EventHandler<Parameters<ServerToClientEvents[K]>[0]>;
};
