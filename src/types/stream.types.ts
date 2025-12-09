// ==============================
// Stream/Media Types
// ==============================

import type { Transport, Producer, Consumer, RtpCapabilities } from 'mediasoup-client/types';

export interface ConsumerState {
  combinedStream: MediaStream;
  userId: string;
  consumerTransport?: Transport;
  audioConsumer?: Consumer | null;
  videoConsumer?: Consumer | null;
}

export interface ConsumersMap {
  [audioPid: string]: ConsumerState;
}

export interface ProducerState {
  audioProducer: Producer | null;
  videoProducer: Producer | null;
  screenAudioProducer: Producer | null;
  screenVideoProducer: Producer | null;
  producerTransport: Transport | null;
  screenTransport: Transport | null;
}

export interface NewProducersData {
  audioPidsToCreate: string[];
  videoPidsToCreate: (string | null)[];
  associatedUserIds: string[];
}

export interface MediaJoinRoomResponse {
  routerRtpCapabilities: RtpCapabilities;
  newRoom: boolean;
  audioPidsToCreate?: string[];
  videoPidsToCreate?: (string | null)[];
  associatedUserIds?: string[];
  error?: string;
}

export interface MediaState {
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}
