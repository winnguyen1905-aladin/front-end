// Mediasoup utility functions extracted from StreamContext
// Handles transport creation, consumer/producer management

import { Device } from 'mediasoup-client';
import { Transport, Consumer, Producer } from 'mediasoup-client/types';
import { Socket } from 'socket.io-client';

// ==============================
// Types
// ==============================

export interface UserInfo {
  id: string;
  displayName: string;
}

export interface ConsumerState {
  combinedStream: MediaStream;
  user: UserInfo;
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
  associatedUsers: UserInfo[];
}

// ==============================
// Consumer Creation
// ==============================

export async function createConsumer(
  socket: Socket,
  device: Device,
  transport: Transport,
  pid: string,
  kind: 'audio' | 'video'
): Promise<Consumer | null> {
  try {
    const consumerParams = await socket.emitWithAck('consumeMedia', {
      rtpCapabilities: device.rtpCapabilities,
      pid,
      kind,
    });

    if (consumerParams === 'cannotConsume' || consumerParams === 'consumeFailed') {
      return null;
    }

    const consumer = await transport.consume(consumerParams);
    socket.emitWithAck('unpauseConsumer', { pid, kind }).catch(console.error);

    return consumer;
  } catch (error) {
    console.error('[mediasoupUtils] Create consumer failed:', error);
    return null;
  }
}

// ==============================
// Transport Creation
// ==============================

export async function createProducerTransport(
  socket: Socket,
  device: Device
): Promise<Transport> {
  const transportParams = await socket.emitWithAck('requestTransport', { type: 'producer' });
  const producerTransport = device.createSendTransport(transportParams);

  producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      const result = await socket.emitWithAck('connectTransport', {
        dtlsParameters,
        type: 'producer',
      });
      result === 'success' ? callback() : errback(new Error('Connect failed'));
    } catch (err) {
      errback(err as Error);
    }
  });

  producerTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
    try {
      const isScreen = appData?.source === 'screen';
      const streamKind = isScreen ? (kind === 'audio' ? 'screenAudio' : 'screenVideo') : kind;

      const producerId = await socket.emitWithAck('startProducing', {
        kind: streamKind,
        rtpParameters,
      });

      producerId === 'error'
        ? errback(new Error('Produce failed'))
        : callback({ id: producerId });
    } catch (err) {
      errback(err as Error);
    }
  });

  return producerTransport;
}

export async function createConsumerTransport(
  socket: Socket,
  device: Device,
  audioPid: string
): Promise<Transport> {
  const transportParams = await socket.emitWithAck('requestTransport', {
    type: 'consumer',
    audioPid,
  });

  const consumerTransport = device.createRecvTransport(transportParams);

  consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      const result = await socket.emitWithAck('connectTransport', {
        dtlsParameters,
        type: 'consumer',
        audioPid,
      });
      result === 'success' ? callback() : errback(new Error('Connect failed'));
    } catch (err) {
      errback(err as Error);
    }
  });

  return consumerTransport;
}

// ==============================
// Consume Producers
// ==============================

export async function consumeProducers(
  socket: Socket,
  device: Device,
  data: NewProducersData,
  consumersMap: ConsumersMap
): Promise<ConsumersMap> {
  const { audioPidsToCreate, videoPidsToCreate, associatedUsers } = data;

  for (let i = 0; i < audioPidsToCreate.length; i++) {
    const audioPid = audioPidsToCreate[i];
    const videoPid = videoPidsToCreate[i];
    const user = associatedUsers[i];

    // Skip if consumer already exists
    if (consumersMap[audioPid]) {
      console.log('[mediasoupUtils] Consumer already exists:', audioPid);
      continue;
    }

    try {
      const consumerTransport = await createConsumerTransport(socket, device, audioPid);

      const audioConsumer = await createConsumer(socket, device, consumerTransport, audioPid, 'audio');
      const videoConsumer = videoPid
        ? await createConsumer(socket, device, consumerTransport, videoPid, 'video')
        : null;

      const tracks: MediaStreamTrack[] = [];
      if (audioConsumer?.track) tracks.push(audioConsumer.track);
      if (videoConsumer?.track) tracks.push(videoConsumer.track);

      consumersMap[audioPid] = {
        combinedStream: new MediaStream(tracks),
        user,
        consumerTransport,
        audioConsumer,
        videoConsumer,
      };
    } catch (error) {
      console.error('[mediasoupUtils] Failed to consume:', audioPid, error);
    }
  }

  return consumersMap;
}

// ==============================
// Cleanup Utilities
// ==============================

export function closeConsumer(consumerState: ConsumerState): void {
  consumerState.audioConsumer?.close();
  consumerState.videoConsumer?.close();
  consumerState.consumerTransport?.close();
}

export function closeAllConsumers(consumersMap: ConsumersMap): void {
  for (const consumerState of Object.values(consumersMap)) {
    closeConsumer(consumerState);
  }
}

export function closeProducers(producerState: ProducerState): void {
  producerState.audioProducer?.close();
  producerState.videoProducer?.close();
  producerState.screenAudioProducer?.close();
  producerState.screenVideoProducer?.close();
  producerState.producerTransport?.close();
  producerState.screenTransport?.close();
}

export function createEmptyProducerState(): ProducerState {
  return {
    audioProducer: null,
    videoProducer: null,
    screenAudioProducer: null,
    screenVideoProducer: null,
    producerTransport: null,
    screenTransport: null,
  };
}

// ==============================
// Video Element Utilities
// ==============================

export function clearVideoElementsForConsumer(consumerState: ConsumerState): void {
  try {
    const remoteVideos = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
    for (let i = 0; i < remoteVideos.length; i++) {
      const videoEl = remoteVideos[i];
      if (videoEl.srcObject === consumerState.combinedStream) {
        videoEl.srcObject = null;
        const usernameEl = document.getElementById(`username-${i}`);
        if (usernameEl) usernameEl.innerHTML = '';
      }
    }
  } catch (error) {
    console.warn('[mediasoupUtils] Error clearing video elements:', error);
  }
}

export function clearAllRemoteVideos(): void {
  const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
  Array.from(remoteEls).forEach(el => { el.srcObject = null; });
}
