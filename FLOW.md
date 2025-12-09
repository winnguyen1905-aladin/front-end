# Video Conference Event Flow

This document describes the socket.io events flow after joining a video call room.

---

## 1. Connection Phase

### Socket Connection
```
Client                              Server
   |                                   |
   |-------- connect (auto) ---------->|  Socket.io connects to /call namespace
   |<------- connect (ack) ------------|  Server confirms connection
   |                                   |
```

**Events:**
- `connect` - Socket.io built-in event when connection is established

---

## 2. Join Room Phase

### Client Joins Room
```
Client                              Server
   |                                   |
   |-------- joinRoom --------------->|  { userId, roomId }
   |<------- joinRoom (ack) ----------|  Returns: routerRtpCapabilities, newRoom, 
   |                                   |           audioPidsToCreate, videoPidsToCreate,
   |                                   |           associatedUserIds
```

**Event Sent:** `joinRoom`
- **Payload:** `{ userId: string, roomId: string }`
- **Why:** Tells server which room to join and identifies the user
- **Response:** Server returns mediasoup router RTP capabilities needed to initialize the device

---

## 3. Device Initialization (Client-side only)

After receiving `routerRtpCapabilities`, the client loads the mediasoup Device:
```javascript
device.load({ routerRtpCapabilities });
```
No socket events - this is local WebRTC setup.

---

## 4. Consume Existing Producers

If the room has existing participants, server sends their producer info.

### 4.1 New Producers Notification
```
Client                              Server
   |                                   |
   |<----- newProducersToConsume -----|  { audioPidsToCreate, videoPidsToCreate, 
   |                                   |    associatedUserIds }
```

**Event Received:** `newProducersToConsume`
- **Payload:** 
  - `audioPidsToCreate: string[]` - Audio producer IDs to consume
  - `videoPidsToCreate: (string | null)[]` - Video producer IDs (null if no video)
  - `associatedUserIds: string[]` - User names for each producer
- **Why:** Server tells client about existing participants' media streams

### 4.2 Request Consumer Transport
```
Client                              Server
   |                                   |
   |-------- requestTransport -------->|  { type: 'consumer', audioPid }
   |<------- requestTransport (ack) ---|  Transport parameters
```

**Event Sent:** `requestTransport`
- **Payload:** `{ type: 'consumer', audioPid: string }`
- **Why:** Request server to create a transport for receiving media

### 4.3 Connect Consumer Transport
```
Client                              Server
   |                                   |
   |-------- connectTransport -------->|  { dtlsParameters, type: 'consumer', audioPid }
   |<------- connectTransport (ack) ---|  'success' or error
```

**Event Sent:** `connectTransport`
- **Payload:** `{ dtlsParameters, type: 'consumer', audioPid }`
- **Why:** Complete WebRTC DTLS handshake for secure connection

### 4.4 Consume Media
```
Client                              Server
   |                                   |
   |-------- consumeMedia ------------>|  { rtpCapabilities, pid, kind }
   |<------- consumeMedia (ack) -------|  Consumer parameters or 'cannotConsume'
```

**Event Sent:** `consumeMedia`
- **Payload:** `{ rtpCapabilities, pid: string, kind: 'audio' | 'video' }`
- **Why:** Request to consume a specific producer's media track

### 4.5 Unpause Consumer
```
Client                              Server
   |                                   |
   |-------- unpauseConsumer --------->|  { pid, kind }
   |<------- unpauseConsumer (ack) ----|  Confirmation
```

**Event Sent:** `unpauseConsumer`
- **Payload:** `{ pid: string, kind: 'audio' | 'video' }`
- **Why:** Consumers are created paused by default; this starts the media flow

---

## 5. Start Producing (Broadcasting)

### 5.1 Request Producer Transport
```
Client                              Server
   |                                   |
   |-------- requestTransport -------->|  { type: 'producer' }
   |<------- requestTransport (ack) ---|  Transport parameters
```

**Event Sent:** `requestTransport`
- **Payload:** `{ type: 'producer' }`
- **Why:** Request server to create a transport for sending media

### 5.2 Connect Producer Transport
```
Client                              Server
   |                                   |
   |-------- connectTransport -------->|  { dtlsParameters, type: 'producer' }
   |<------- connectTransport (ack) ---|  'success' or error
```

**Event Sent:** `connectTransport`
- **Payload:** `{ dtlsParameters, type: 'producer' }`
- **Why:** Complete WebRTC DTLS handshake for sending media

### 5.3 Start Producing
```
Client                              Server
   |                                   |
   |-------- startProducing ---------->|  { kind, rtpParameters }
   |<------- startProducing (ack) -----|  producerId or 'error'
```

**Event Sent:** `startProducing`
- **Payload:** `{ kind: 'audio' | 'video' | 'screenAudio' | 'screenVideo', rtpParameters }`
- **Why:** Tell server about the media track being produced; server creates a Producer

---

## 6. Active Speakers Updates

```
Client                              Server
   |                                   |
   |<----- updateActiveSpeakers ------|  string[] (list of active audio producer IDs)
   |                                   |
   |<----- activeSpeakersUpdate ------|  string[] (alternative event name)
```

**Event Received:** `updateActiveSpeakers` / `activeSpeakersUpdate`
- **Payload:** `string[]` - Array of audio producer IDs currently speaking
- **Why:** Server detects who is speaking based on audio levels; client uses this to show active speakers prominently

---

## 7. Runtime Events

### Producer Paused/Resumed
```
Client                              Server
   |                                   |
   |<------- producerPaused ----------|  { producerId }
   |<------- producerResumed ---------|  { producerId }
```

**Why:** Notifies when a remote user mutes/unmutes their audio or disables/enables video

### Consumer Paused/Resumed
```
Client                              Server
   |                                   |
   |<------- consumerPaused ----------|  { consumerId, kind }
   |<------- consumerResumed ---------|  { consumerId, kind }
```

**Why:** Server-side consumer state changes

### Producer Closed
```
Client                              Server
   |                                   |
   |<------- producerClosed ----------|  { producerId, userId }
```

**Why:** A remote user stopped producing a track (e.g., stopped screen sharing)

### Audio Change
```
Client                              Server
   |                                   |
   |-------- audioChange ------------->|  { action: 'mute' | 'unmute' }
```

**Event Sent:** `audioChange`
- **Why:** Notify server when local user mutes/unmutes

---

## 8. Participant Left

```
Client                              Server
   |                                   |
   |<------- participantLeft ---------|  { participantId, userId }
   |<------- userLeft ----------------|  { participantId, userId }
```

**Event Received:** `participantLeft` / `userLeft`
- **Why:** A user left the room; client cleans up their consumers

---

## 9. Leave Room

```
Client                              Server
   |                                   |
   |-------- leaveRoom --------------->|  (no payload)
   |                                   |
```

**Event Sent:** `leaveRoom`
- **Why:** Notify server that user is leaving; server cleans up producers/consumers

---

## 10. Screen Sharing

### Start Screen Share
Same flow as producing (steps 5.1-5.3) but with:
- `kind: 'screenVideo'` or `kind: 'screenAudio'`

### Stop Screen Share
```
Client                              Server
   |                                   |
   |-------- closeProducers ---------->|  { producerIds: string[] }
```

**Event Sent:** `closeProducers`
- **Payload:** `{ producerIds: string[] }`
- **Why:** Tell server to close the screen share producers

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDEO CONFERENCE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. CONNECT
   └── Socket.io auto-connects to server/call namespace

2. JOIN ROOM
   └── emit('joinRoom') → receive routerRtpCapabilities
       └── device.load(routerRtpCapabilities)

3. CONSUME EXISTING PARTICIPANTS (if not new room)
   └── on('newProducersToConsume')
       └── For each producer:
           ├── emit('requestTransport', { type: 'consumer' })
           ├── emit('connectTransport', { dtlsParameters })
           ├── emit('consumeMedia', { pid, kind: 'audio' })
           ├── emit('consumeMedia', { pid, kind: 'video' })
           └── emit('unpauseConsumer', { pid, kind })

4. START BROADCASTING
   └── getUserMedia() → localStream
       └── emit('requestTransport', { type: 'producer' })
           └── emit('connectTransport', { dtlsParameters })
               ├── emit('startProducing', { kind: 'audio' })
               └── emit('startProducing', { kind: 'video' })

5. RUNTIME
   ├── on('updateActiveSpeakers') → update UI
   ├── on('newProducersToConsume') → consume new participants
   ├── on('producerClosed') → cleanup consumer
   ├── on('participantLeft') → cleanup all consumers for user
   └── emit('audioChange') → when muting/unmuting

6. LEAVE
   └── emit('leaveRoom')
       └── disconnect()
```

---

## Event Summary Table

| Direction | Event | When | Payload |
|-----------|-------|------|---------|
| → Server | `joinRoom` | Joining a room | `{ userId, roomId }` |
| ← Client | `newProducersToConsume` | Existing/new participants | `{ audioPids, videoPids, userNames }` |
| → Server | `requestTransport` | Need transport | `{ type, audioPid? }` |
| → Server | `connectTransport` | DTLS handshake | `{ dtlsParameters, type }` |
| → Server | `consumeMedia` | Want to receive track | `{ rtpCapabilities, pid, kind }` |
| → Server | `unpauseConsumer` | Start receiving | `{ pid, kind }` |
| → Server | `startProducing` | Start sending track | `{ kind, rtpParameters }` |
| ← Client | `updateActiveSpeakers` | Speaking detection | `string[]` |
| ← Client | `producerClosed` | Track stopped | `{ producerId }` |
| ← Client | `participantLeft` | User left | `{ participantId, userId }` |
| → Server | `audioChange` | Mute/unmute | `{ action }` |
| → Server | `closeProducers` | Stop screen share | `{ producerIds }` |
| → Server | `leaveRoom` | Leaving room | - |
