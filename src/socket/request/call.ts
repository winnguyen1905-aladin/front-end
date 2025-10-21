import { types } from 'mediasoup-client';

// ==============================
// Request Types (Client to Server)
// ==============================

/**
 * Request data for joining a room
 */
export interface JoinRoomRequest {
  userName: string;
  roomName: string;
}

/**
 * Request data for audio control (mute/unmute)
 */
export interface AudioChangeRequest {
  action: 'mute' | 'unmute';
}

/**
 * Request data for consuming media
 */
export interface ConsumeRequest {
  rtpCapabilities: types.RtpCapabilities;
}

// ==============================
// Transport and Producer Request Types
// ==============================

/**
 * Request data for creating producer transport
 */
export interface CreateProducerTransportRequest {
  type: 'producer';
  forceTcp?: boolean;
}

/**
 * Request data for creating consumer transport
 */
export interface CreateConsumerTransportRequest {
  type: 'consumer';
  audioPid: string;
  forceTcp?: boolean;
}

/**
 * Request data for connecting producer transport
 */
export interface ConnectProducerTransportRequest {
  transportId: string;
  dtlsParameters: types.DtlsParameters;
}

/**
 * Request data for connecting consumer transport
 */
export interface ConnectConsumerTransportRequest {
  transportId: string;
  dtlsParameters: types.DtlsParameters;
}

/**
 * Request data for creating a producer
 */
export interface CreateProducerRequest {
  transportId: string;
  kind: types.MediaKind;
  rtpParameters: types.RtpParameters;
}

/**
 * Request data for creating a consumer
 */
export interface CreateConsumerRequest {
  transportId: string;
  producerId: string;
  kind: types.MediaKind;
  rtpParameters: types.RtpParameters;
}
