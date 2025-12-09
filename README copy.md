# Socket Module - Room Management Events

This document describes the WebSocket events for room management in the call namespace.

## Overview

The room management system supports:
- **Join Request Flow**: Non-owners must request approval from the room owner to join
- **Kick/Block Flow**: Room owners can remove or permanently ban users

---

## Data Types

### Request Types

```typescript
interface JoinRoomData {
  userId: string;
  roomId: string;
  password?: string;
}

interface JoinRoomRequestData {
  userId: string;
  roomId: string;
  password?: string;
  displayName?: string;  // Optional display name shown to owner
}

interface AcceptJoinRoomData {
  requestId: string;
  userId: string;
}

interface KickOutRoomData {
  userId: string;  // User to kick
}

interface BlockUserData {
  userId: string;       // User to block
  durationMs?: number;  // Ban duration in ms (default: 24 hours)
}
```

### Response Types

```typescript
interface JoinRoomResponse {
  routerRtpCapabilities?: any;
  newRoom?: boolean;
  audioPidsToCreate?: string[];
  videoPidsToCreate?: (string | null)[];
  associatedUserIds?: string[];
  pendingApproval?: boolean;  // true if waiting for owner approval
  requestId?: string;         // Unique request ID for tracking
  error?: string;
}

interface AcceptJoinRoomResponse {
  success?: boolean;
  error?: string;
}

interface KickOutRoomResponse {
  success?: boolean;
  error?: string;
}

interface BlockUserResponse {
  success?: boolean;
  error?: string;
}
```

### Internal Types (Server-side)

```typescript
interface PendingJoinRequest {
  requestId: string;
  userId: string;
  displayName?: string;
  socketId: string;
  timestamp: number;
}

interface BanInfo {
  userId: string;
  expiresAt: number;  // Unix timestamp
}
```

---

## Client → Server Events

### `joinRoom`
Direct join a room. Use for creating new rooms or when you're the owner.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ | Your user ID |
| `roomId` | string | ✅ | Room to join |
| `password` | string | ❌ | Room password if required |

**Response**: `JoinRoomResponse`

---

### `joinRoomRequest`
Request to join an existing room. Sends approval request to owner.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ | Your user ID |
| `roomId` | string | ✅ | Room to join |
| `password` | string | ❌ | Room password if required |
| `displayName` | string | ❌ | Name shown to owner |

**Response**: 
- If new room or you're owner: Full `JoinRoomResponse`
- If existing room: `{ pendingApproval: true, requestId: string }`

---

### `acceptJoinRoom`
Owner accepts a pending join request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | ✅ | The pending request ID |
| `userId` | string | ✅ | User being accepted |

**Response**: `{ success: boolean, error?: string }`

---

### `rejectJoinRoom`
Owner rejects a pending join request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | ✅ | The pending request ID |

**Response**: `{ success: boolean, error?: string }`

---

### `kickOutRoom`
Owner kicks a user from the room.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ | User to kick |

**Response**: `{ success: boolean, error?: string }`

---

### `blockUser`
Owner blocks a user (kicks + adds to blacklist).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ | User to block |
| `durationMs` | number | ❌ | Ban duration (default: 24 hours) |

**Response**: `{ success: boolean, error?: string }`

---

## Server → Client Events

### `joinRoomRequest`
Sent to room owner when someone requests to join.

```typescript
{
  requestId: string;
  userId: string;
  displayName?: string;
  roomId: string;
}
```

---

### `joinRequestAccepted`
Sent to requester when owner accepts their request.

```typescript
{
  roomId: string;
  requestId: string;
}
```

**Next Step**: Client should now emit `joinRoom` to complete joining.

---

### `joinRequestRejected`
Sent to requester when owner rejects their request.

```typescript
{
  roomId: string;
  requestId: string;
}
```

---

### `kickedFromRoom`
Sent to user when they are kicked.

```typescript
{
  roomId: string;
  reason: string;
}
```

---

### `blockedFromRoom`
Sent to user when they are blocked.

```typescript
{
  roomId: string;
  reason: string;
  expiresAt: number;  // Unix timestamp when ban expires
}
```

---

### `userKicked`
Broadcast to all room members when a user is kicked.

```typescript
{
  userId: string;
}
```

---

### `userBlocked`
Broadcast to all room members when a user is blocked.

```typescript
{
  userId: string;
}
```

---

## Flow Diagrams

### Join Request Flow

```
┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
│   Requester  │                    │    Server    │                    │  Room Owner  │
└──────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │ emit: joinRoomRequest             │                                   │
       │ { userId, roomId, displayName }   │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │ emit: joinRoomRequest             │
       │                                   │ { requestId, userId, displayName }│
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │ ack: { pendingApproval: true,     │                                   │
       │        requestId: "xxx" }         │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │                                   │         [Owner decides]           │
       │                                   │                                   │
       │                                   │ emit: acceptJoinRoom              │
       │                                   │ { requestId, userId }             │
       │                                   │<──────────────────────────────────│
       │                                   │                                   │
       │ emit: joinRequestAccepted         │ ack: { success: true }            │
       │ { roomId, requestId }             │──────────────────────────────────>│
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │ emit: joinRoom                    │                                   │
       │ { userId, roomId }                │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │ ack: { routerRtpCapabilities,     │                                   │
       │        audioPidsToCreate, ... }   │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
```

### Kick User Flow

```
┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
│  Room Owner  │                    │    Server    │                    │ Target User  │
└──────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │ emit: kickOutRoom                 │                                   │
       │ { userId: "target" }              │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │ emit: kickedFromRoom              │
       │                                   │ { roomId, reason }                │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │                                   │ [disconnect socket]               │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │ ack: { success: true }            │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │                                   │ broadcast: userKicked             │
       │ emit: userKicked                  │ { userId: "target" }              │
       │<──────────────────────────────────│──────────────> [other members]    │
       │                                   │                                   │
```

### Block User Flow

```
┌──────────────┐                    ┌──────────────┐                    ┌──────────────┐
│  Room Owner  │                    │    Server    │                    │ Target User  │
└──────────────┘                    └──────────────┘                    └──────────────┘
       │                                   │                                   │
       │ emit: blockUser                   │                                   │
       │ { userId, durationMs? }           │                                   │
       │──────────────────────────────────>│                                   │
       │                                   │                                   │
       │                                   │ [add to blacklist]                │
       │                                   │                                   │
       │                                   │ emit: blockedFromRoom             │
       │                                   │ { roomId, reason, expiresAt }     │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │                                   │ [disconnect socket]               │
       │                                   │──────────────────────────────────>│
       │                                   │                                   │
       │ ack: { success: true }            │                                   │
       │<──────────────────────────────────│                                   │
       │                                   │                                   │
       │                                   │ broadcast: userBlocked            │
       │ emit: userBlocked                 │ { userId: "target" }              │
       │<──────────────────────────────────│──────────────> [other members]    │
       │                                   │                                   │
```

---

## Error Handling

All events return an `error` field when something goes wrong:

| Error Message | Cause |
|---------------|-------|
| `"Incorrect password"` | Wrong room password |
| `"User is blacklisted from this room"` | User is banned |
| `"Room is full"` | Room at max capacity |
| `"You are not in a room"` | Caller not in any room |
| `"Only room owner can accept join requests"` | Non-owner tried owner action |
| `"Only room owner can kick users"` | Non-owner tried to kick |
| `"Only room owner can block users"` | Non-owner tried to block |
| `"Cannot kick yourself"` | Owner tried to kick themselves |
| `"Cannot block yourself"` | Owner tried to block themselves |
| `"User not found in room"` | Target user not in room |
| `"Join request not found or expired"` | Invalid or expired request ID |

---

## Client Implementation Example

```typescript
// Socket.io client example
const socket = io('/call', { query: { token: 'your-jwt-token' } });

// === Joining a Room ===

// For creating a new room or if you're the owner
socket.emit('joinRoom', { userId: 'user123', roomId: 'room456' }, (response) => {
  if (response.error) {
    console.error('Join failed:', response.error);
  } else {
    console.log('Joined room:', response);
  }
});

// For joining an existing room (requires owner approval)
socket.emit('joinRoomRequest', { 
  userId: 'user123', 
  roomId: 'room456',
  displayName: 'John Doe'
}, (response) => {
  if (response.error) {
    console.error('Request failed:', response.error);
  } else if (response.pendingApproval) {
    console.log('Waiting for owner approval, requestId:', response.requestId);
  } else {
    // Direct join happened (you're the owner or new room)
    console.log('Joined room:', response);
  }
});

// === Listen for approval/rejection ===

socket.on('joinRequestAccepted', ({ roomId, requestId }) => {
  console.log('Request accepted! Now joining...');
  socket.emit('joinRoom', { userId: 'user123', roomId }, (response) => {
    console.log('Joined room:', response);
  });
});

socket.on('joinRequestRejected', ({ roomId, requestId }) => {
  console.log('Request rejected by owner');
});

// === Owner: Handle join requests ===

socket.on('joinRoomRequest', ({ requestId, userId, displayName, roomId }) => {
  console.log(`${displayName || userId} wants to join`);
  
  // Accept
  socket.emit('acceptJoinRoom', { requestId, userId }, (response) => {
    console.log('Accepted:', response);
  });
  
  // Or reject
  socket.emit('rejectJoinRoom', { requestId }, (response) => {
    console.log('Rejected:', response);
  });
});

// === Owner: Kick/Block users ===

socket.emit('kickOutRoom', { userId: 'badUser' }, (response) => {
  console.log('Kicked:', response);
});

socket.emit('blockUser', { userId: 'badUser', durationMs: 3600000 }, (response) => {
  console.log('Blocked for 1 hour:', response);
});

// === Listen for kick/block events ===

socket.on('kickedFromRoom', ({ roomId, reason }) => {
  console.log('You were kicked:', reason);
  // Redirect to home or show message
});

socket.on('blockedFromRoom', ({ roomId, reason, expiresAt }) => {
  console.log('You were blocked until:', new Date(expiresAt));
  // Redirect to home or show message
});

socket.on('userKicked', ({ userId }) => {
  console.log('User kicked:', userId);
  // Update UI to remove user
});

socket.on('userBlocked', ({ userId }) => {
  console.log('User blocked:', userId);
  // Update UI to remove user
});
```
