// ==============================
// Room Management Types
// Based on Socket Module - Room Management Events
// ==============================

// ==============================
// Request Types (Client → Server)
// ==============================

export interface JoinRoomData {
  userId: string;
  roomId: string;
  password?: string;
}

export interface JoinRoomRequestData {
  userId: string;
  roomId: string;
  password?: string;
  displayName?: string;
}

export interface AcceptJoinRoomData {
  requestId: string;
  userId: string;
}

export interface RejectJoinRoomData {
  requestId: string;
}

export interface KickOutRoomData {
  userId: string;
}

export interface BlockUserData {
  userId: string;
  durationMs?: number; // default: 24 hours
}

// ==============================
// Response Types (Server → Client)
// ==============================

export interface JoinRoomResponse {
  routerRtpCapabilities?: any;
  newRoom?: boolean;
  audioPidsToCreate?: string[];
  videoPidsToCreate?: (string | null)[];
  associatedUserIds?: string[];
  pendingApproval?: boolean;
  requestId?: string;
  error?: string;
}

export interface AcceptJoinRoomResponse {
  success?: boolean;
  error?: string;
}

export interface RejectJoinRoomResponse {
  success?: boolean;
  error?: string;
}

export interface KickOutRoomResponse {
  success?: boolean;
  error?: string;
}

export interface BlockUserResponse {
  success?: boolean;
  error?: string;
}

// ==============================
// Server → Client Event Payloads
// ==============================

export interface JoinRequestEvent {
  requestId: string;
  userId: string;
  displayName?: string;
  roomId: string;
}

export interface JoinRequestAcceptedEvent {
  roomId: string;
  requestId: string;
}

export interface JoinRequestRejectedEvent {
  roomId: string;
  requestId: string;
}

export interface KickedFromRoomEvent {
  roomId: string;
  reason: string;
}

export interface BlockedFromRoomEvent {
  roomId: string;
  reason: string;
  expiresAt: number;
}

export interface UserKickedEvent {
  userId: string;
}

export interface UserBlockedEvent {
  userId: string;
}

// ==============================
// Internal Types
// ==============================

export interface PendingJoinRequest {
  requestId: string;
  userId: string;
  displayName?: string;
  timestamp: number;
}

export interface Participant {
  id: string;
  displayName: string;
  isOwner: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  audioPid?: string;
  videoPid?: string;
}

export type RoomStatus = 
  | 'idle' 
  | 'requesting' 
  | 'pending_approval' 
  | 'joining' 
  | 'joined' 
  | 'kicked' 
  | 'blocked' 
  | 'error';

export interface RoomState {
  roomId: string | null;
  userId: string | null;
  displayName: string | null;
  status: RoomStatus;
  isOwner: boolean;
  pendingRequestId: string | null;
  pendingJoinRequests: PendingJoinRequest[];
  participants: Participant[];
  error: string | null;
  blockedUntil: number | null;
  kickReason: string | null;
}
