import { types } from 'mediasoup-client';

// ==============================
// Response Types (Server to Client)
// ==============================

/**
 * Response data when joining a room
 */
export interface JoinRoomResponse {
  routerRtpCapabilities: types.RtpCapabilities;
  existingProducers?: Array<{
    id: string;
    kind: 'audio' | 'video';
    rtpParameters: types.RtpParameters;
    userName: string;
  }>;
  [key: string]: any;
}

/**
 * Response data for consume request
 */
export interface ConsumeResponse {
  producersToConsume: Array<{
    id: string;
    kind: 'audio' | 'video';
    rtpParameters: types.RtpParameters;
    userName: string;
  }>;
}

// ==============================
// Server Push Event Types
// ==============================

/**
 * Active speakers update event data
 */
export interface ActiveSpeakersUpdate {
  activeSpeakers: string[];
  timestamp?: number;
}

/**
 * New producers available for consumption
 */
export interface NewProducersData {
  producers: Array<{
    id: string;
    kind: 'audio' | 'video';
    rtpParameters: types.RtpParameters;
    userName: string;
    userId?: string;
  }>;
}

/**
 * Producer closed event data
 */
export interface ProducerClosedData {
  producerId: string;
  kind: 'audio' | 'video';
  userId?: string;
}

/**
 * User left room event data
 */
export interface UserLeftData {
  userId: string;
  userName: string;
  producerIds: string[];
}

// ==============================
// Transport and Producer Response Types
// ==============================

/**
 * Response data for transport creation
 */
export interface TransportResponse {
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: types.DtlsParameters;
  sctpParameters?: types.SctpParameters;
}

/**
 * Response data for producer creation
 */
export interface ProducerResponse {
  id: string;
}

/**
 * Response data for consumer creation
 */
export interface ConsumerResponse {
  id: string;
  producerId: string;
  kind: types.MediaKind;
  rtpParameters: types.RtpParameters;
}

// ==============================
// Call Event Data Types
// ==============================

/**
 * Call-related event data types
 */
export interface CallEventData {
  // Producer events
  newProducer?: {
    audioPidsToCreate: string[];
    videoPidsToCreate: (string | null)[];
    associatedUserNames: string[];
  };
  
  // Consumer events
  consumerPaused?: {
    consumerId: string;
    kind: 'audio' | 'video';
  };
  
  consumerResumed?: {
    consumerId: string;
    kind: 'audio' | 'video';
  };
  
  // Producer events
  producerPaused?: {
    producerId: string;
    kind: 'audio' | 'video';
  };
  
  producerResumed?: {
    producerId: string;
    kind: 'audio' | 'video';
  };
  
  // Transport events
  transportConnected?: {
    transportId: string;
    dtlsState: string;
  };
  
  transportClosed?: {
    transportId: string;
  };
  
  // Room events
  userJoined?: {
    userId: string;
    userName: string;
  };
  
  // Participant events
  participantLeft?: {
    participantId: string;
    userName: string;
  };
}
