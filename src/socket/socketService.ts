import { io, Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/types';

// ==============================
// Types
// ==============================

export interface ConsumerState {
  combinedStream: MediaStream;
  userName: string;
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

export interface JoinRoomResponse {
  routerRtpCapabilities: types.RtpCapabilities;
}

export interface VideoCallHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onActiveSpeakersUpdate?: (speakers: string[]) => void;
  onNewProducers?: (data: NewProducersData) => void;
  onProducerClosed?: (data: { producerId: string }) => void;
  onUserLeft?: (data: { participantId: string; userName: string }) => void;
}

export interface NewProducersData {
  audioPidsToCreate: string[];
  videoPidsToCreate: (string | null)[];
  associatedUserNames: string[];
}

// ==============================
// Video Call Socket Service
// ==============================

class VideoCallSocketService {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private deviceLoaded = false;
  private consumers: ConsumersMap = {};
  private producerState: ProducerState = {
    audioProducer: null,
    videoProducer: null,
    screenAudioProducer: null,
    screenVideoProducer: null,
    producerTransport: null,
    screenTransport: null,
  };
  private handlers: VideoCallHandlers = {};

  // ==============================
  // Connection Management
  // ==============================

  connect(serverUrl: string, handlers: VideoCallHandlers = {}): void {
    if (this.socket?.connected) {
      console.log('[VideoCallSocket] Already connected');
      return;
    }

    this.handlers = handlers;
    this.socket = io(serverUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    this.setupListeners();
    console.log('[VideoCallSocket] Connecting to:', serverUrl);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.cleanup();
    console.log('[VideoCallSocket] Disconnected');
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }

  // ==============================
  // Event Listeners Setup
  // ==============================

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[VideoCallSocket] Connected:', this.socket?.id);
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[VideoCallSocket] Disconnected:', reason);
      this.handlers.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[VideoCallSocket] Connection error:', error);
      this.handlers.onError?.(error);
    });

    // Video call events
    this.socket.on('updateActiveSpeakers', (data: string[] | { activeSpeakers: string[] }) => {
      const speakers = Array.isArray(data) ? data : data.activeSpeakers;
      console.log('[VideoCallSocket] Active speakers:', speakers);
      this.handlers.onActiveSpeakersUpdate?.(speakers);
    });

    this.socket.on('newProducersToConsume', async (data: NewProducersData) => {
      console.log('[VideoCallSocket] New producers:', data);
      this.handlers.onNewProducers?.(data);
      await this.consumeProducers(data);
    });

    this.socket.on('producerClosed', (data: { producerId: string }) => {
      console.log('[VideoCallSocket] Producer closed:', data);
      this.handleProducerClosed(data);
      this.handlers.onProducerClosed?.(data);
    });

    this.socket.on('userLeft', (data: { participantId: string; userName: string }) => {
      console.log('[VideoCallSocket] User left:', data);
      this.handleUserLeft(data);
      this.handlers.onUserLeft?.(data);
    });
  }

  updateHandlers(handlers: Partial<VideoCallHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // ==============================
  // Room Management
  // ==============================

  async joinRoom(userName: string, roomName: string): Promise<JoinRoomResponse> {
    if (!this.socket) throw new Error('Socket not connected');

    const response = await this.socket.emitWithAck('joinRoom', { userName, roomName });
    console.log('[VideoCallSocket] Joined room:', response);
    return response;
  }

  leaveRoom(): void {
    this.socket?.emit('leaveRoom');
    console.log('[VideoCallSocket] Left room');
  }

  sendAudioChange(action: 'mute' | 'unmute'): void {
    this.socket?.emit('audioChange', { action });
  }

  // ==============================
  // Device Management
  // ==============================

  async initDevice(routerRtpCapabilities: types.RtpCapabilities): Promise<Device> {
    if (!this.device) {
      this.device = new Device();
    }
    
    if (!this.deviceLoaded) {
      await this.device.load({ routerRtpCapabilities });
      this.deviceLoaded = true;
      console.log('[VideoCallSocket] Device loaded');
    }
    
    return this.device;
  }

  getDevice(): Device | null {
    return this.device;
  }

  isDeviceReady(): boolean {
    return this.deviceLoaded && this.device !== null;
  }

  // ==============================
  // Producer Management
  // ==============================

  async startProducing(localStream: MediaStream): Promise<ProducerState> {
    if (!this.socket || !this.device) throw new Error('Socket or device not ready');

    const producerTransport = await this.createProducerTransport();
    
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    const videoProducer = videoTrack 
      ? await producerTransport.produce({ track: videoTrack })
      : null;
    const audioProducer = audioTrack 
      ? await producerTransport.produce({ track: audioTrack })
      : null;

    this.producerState = {
      ...this.producerState,
      audioProducer,
      videoProducer,
      producerTransport,
    };

    console.log('[VideoCallSocket] Started producing:', {
      audio: audioProducer?.id,
      video: videoProducer?.id,
    });

    return this.producerState;
  }

  async toggleAudio(mute: boolean): Promise<void> {
    if (!this.producerState.audioProducer) return;
    
    if (mute) {
      await this.producerState.audioProducer.pause();
    } else {
      await this.producerState.audioProducer.resume();
    }
    console.log('[VideoCallSocket] Audio', mute ? 'muted' : 'unmuted');
  }

  async toggleVideo(disable: boolean): Promise<void> {
    if (!this.producerState.videoProducer) return;
    
    if (disable) {
      await this.producerState.videoProducer.pause();
    } else {
      await this.producerState.videoProducer.resume();
    }
    console.log('[VideoCallSocket] Video', disable ? 'disabled' : 'enabled');
  }

  async startScreenShare(screenStream: MediaStream): Promise<void> {
    if (!this.socket || !this.device) throw new Error('Socket or device not ready');

    const screenTransport = await this.createProducerTransport();
    
    const videoTrack = screenStream.getVideoTracks()[0];
    const audioTrack = screenStream.getAudioTracks()[0];

    const screenVideoProducer = videoTrack
      ? await screenTransport.produce({ track: videoTrack, appData: { source: 'screen' } })
      : null;
    const screenAudioProducer = audioTrack
      ? await screenTransport.produce({ track: audioTrack, appData: { source: 'screen' } })
      : null;

    this.producerState.screenVideoProducer = screenVideoProducer;
    this.producerState.screenAudioProducer = screenAudioProducer;
    this.producerState.screenTransport = screenTransport;

    console.log('[VideoCallSocket] Screen share started');
  }

  async stopScreenShare(): Promise<void> {
    const producerIds: string[] = [];

    if (this.producerState.screenAudioProducer) {
      producerIds.push(this.producerState.screenAudioProducer.id);
      this.producerState.screenAudioProducer.close();
      this.producerState.screenAudioProducer = null;
    }

    if (this.producerState.screenVideoProducer) {
      producerIds.push(this.producerState.screenVideoProducer.id);
      this.producerState.screenVideoProducer.close();
      this.producerState.screenVideoProducer = null;
    }

    if (this.producerState.screenTransport) {
      this.producerState.screenTransport.close();
      this.producerState.screenTransport = null;
    }

    if (producerIds.length > 0) {
      this.socket?.emit('closeProducers', { producerIds });
    }

    console.log('[VideoCallSocket] Screen share stopped');
  }

  getProducerState(): ProducerState {
    return this.producerState;
  }

  // ==============================
  // Consumer Management
  // ==============================

  async consumeProducers(data: NewProducersData): Promise<void> {
    if (!this.socket || !this.device) return;

    const { audioPidsToCreate, videoPidsToCreate, associatedUserNames } = data;

    for (let i = 0; i < audioPidsToCreate.length; i++) {
      const audioPid = audioPidsToCreate[i];
      const videoPid = videoPidsToCreate[i];
      const userName = associatedUserNames[i];

      try {
        const transportParams = await this.socket.emitWithAck('requestTransport', { 
          type: 'consumer', 
          audioPid 
        });

        const consumerTransport = this.device.createRecvTransport(transportParams);
        
        consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            const result = await this.socket!.emitWithAck('connectTransport', { 
              dtlsParameters, 
              type: 'consumer', 
              audioPid 
            });
            result === 'success' ? callback() : errback(new Error('Connect failed'));
          } catch (err) {
            errback(err as Error);
          }
        });

        const audioConsumer = await this.createConsumer(consumerTransport, audioPid, 'audio');
        const videoConsumer = videoPid 
          ? await this.createConsumer(consumerTransport, videoPid, 'video')
          : null;

        const tracks: MediaStreamTrack[] = [];
        if (audioConsumer?.track) tracks.push(audioConsumer.track);
        if (videoConsumer?.track) tracks.push(videoConsumer.track);

        this.consumers[audioPid] = {
          combinedStream: new MediaStream(tracks),
          userName,
          consumerTransport,
          audioConsumer,
          videoConsumer,
        };

        console.log('[VideoCallSocket] Consumer created for:', userName);
      } catch (error) {
        console.error('[VideoCallSocket] Failed to consume:', audioPid, error);
      }
    }
  }

  getConsumers(): ConsumersMap {
    return this.consumers;
  }

  // ==============================
  // Private Helpers
  // ==============================

  private async createProducerTransport(): Promise<Transport> {
    if (!this.socket || !this.device) throw new Error('Socket or device not ready');

    const transportParams = await this.socket.emitWithAck('requestTransport', { type: 'producer' });
    const producerTransport = this.device.createSendTransport(transportParams);

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        const result = await this.socket!.emitWithAck('connectTransport', { 
          dtlsParameters, 
          type: 'producer' 
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
        
        const producerId = await this.socket!.emitWithAck('startProducing', { 
          kind: streamKind, 
          rtpParameters 
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

  private async createConsumer(
    transport: Transport,
    pid: string,
    kind: 'audio' | 'video'
  ): Promise<Consumer | null> {
    if (!this.socket || !this.device) return null;

    try {
      const consumerParams = await this.socket.emitWithAck('consumeMedia', {
        rtpCapabilities: this.device.rtpCapabilities,
        pid,
        kind,
      });

      if (consumerParams === 'cannotConsume' || consumerParams === 'consumeFailed') {
        return null;
      }

      const consumer = await transport.consume(consumerParams);
      
      // Unpause consumer
      this.socket.emitWithAck('unpauseConsumer', { pid, kind }).catch(console.error);

      return consumer;
    } catch (error) {
      console.error('[VideoCallSocket] Create consumer failed:', error);
      return null;
    }
  }

  private handleProducerClosed(data: { producerId: string }): void {
    for (const [audioPid, state] of Object.entries(this.consumers)) {
      const isAudio = state.audioConsumer?.producerId === data.producerId;
      const isVideo = state.videoConsumer?.producerId === data.producerId;

      if (isAudio || isVideo) {
        if (isAudio && state.audioConsumer) {
          state.audioConsumer.close();
          state.audioConsumer = null;
        }
        if (isVideo && state.videoConsumer) {
          state.videoConsumer.close();
          state.videoConsumer = null;
        }

        if (!state.audioConsumer && !state.videoConsumer) {
          state.consumerTransport?.close();
          delete this.consumers[audioPid];
        }
        break;
      }
    }
  }

  private handleUserLeft(data: { participantId: string }): void {
    const state = this.consumers[data.participantId];
    if (state) {
      state.audioConsumer?.close();
      state.videoConsumer?.close();
      state.consumerTransport?.close();
      delete this.consumers[data.participantId];
    }
  }

  // ==============================
  // Cleanup
  // ==============================

  async endCall(): Promise<void> {
    // Close producers
    this.producerState.audioProducer?.close();
    this.producerState.videoProducer?.close();
    this.producerState.screenAudioProducer?.close();
    this.producerState.screenVideoProducer?.close();
    this.producerState.producerTransport?.close();
    this.producerState.screenTransport?.close();

    // Close consumers
    for (const state of Object.values(this.consumers)) {
      state.audioConsumer?.close();
      state.videoConsumer?.close();
      state.consumerTransport?.close();
    }

    this.cleanup();
    console.log('[VideoCallSocket] Call ended');
  }

  private cleanup(): void {
    this.consumers = {};
    this.producerState = {
      audioProducer: null,
      videoProducer: null,
      screenAudioProducer: null,
      screenVideoProducer: null,
      producerTransport: null,
      screenTransport: null,
    };
  }

  destroy(): void {
    this.endCall();
    this.disconnect();
    this.device = null;
    this.deviceLoaded = false;
  }
}

// Export singleton instance
export const videoCallSocket = new VideoCallSocketService();

// Export class for testing
export { VideoCallSocketService };
