import { Device, types } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/types';
import { Socket } from 'socket.io-client';

// Consumer map interface
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

// Producer state interface
export interface ProducerState {
  audioProducer: Producer | null;
  videoProducer: Producer | null;
  screenAudioProducer: Producer | null;
  screenVideoProducer: Producer | null;
  producerTransport: Transport | null;
  screenTransport: Transport | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
}

// Active speakers management interface
export interface ActiveSpeakersManager {
  updateActiveSpeakers: (speakers: string[]) => void;
}

/**
 * Call Event Handlers - Contains business logic for call events
 * Uses MediaSoup utilities to handle call operations
 */
export class CallEventHandlers {
  private socket: Socket;
  private device: Device;
  private consumers: ConsumersMap;
  private producerState: ProducerState;
  private activeSpeakersManager?: ActiveSpeakersManager;

  constructor(
    socket: Socket,
    device: Device,
    consumers: ConsumersMap = {},
    activeSpeakersManager?: ActiveSpeakersManager
  ) {
    this.socket = socket;
    this.device = device;
    this.consumers = consumers;
    this.activeSpeakersManager = activeSpeakersManager;
    
    this.producerState = {
      audioProducer: null,
      videoProducer: null,
      screenAudioProducer: null,
      screenVideoProducer: null,
      producerTransport: null,
      screenTransport: null,
      localStream: null,
      screenStream: null
    };
  }

  // ==============================
  // Producer Management Handlers
  // ==============================

  /**
   * Create producer transport and start producing local media
   */
  async handleStartProducing(localStream: MediaStream): Promise<ProducerState> {
    try {
      this.log('Starting producer with local stream');
      
      // 1. Create producer transport
      const producerTransport = await this.createProducerTransport();
      
      // 2. Create producers (audio + video)
      const producers = await this.createProducer(localStream, producerTransport);
      
      // 3. Update producer state
      this.producerState = {
        audioProducer: producers.audioProducer,
        videoProducer: producers.videoProducer,
        producerTransport: producerTransport,
        localStream: localStream,
        screenAudioProducer: null,
        screenVideoProducer: null,
        screenTransport: null,
        screenStream: null
      };
      
      this.log('Producer created successfully:', {
        audio: this.producerState.audioProducer?.id,
        video: this.producerState.videoProducer?.id
      });
      
      return this.producerState;
    } catch (error) {
      this.error('Failed to start producing:', error);
      throw error;
    }
  }

  /**
   * Pause/Resume audio producer
   */
  async handleAudioToggle(mute: boolean): Promise<void> {
    if (!this.producerState.audioProducer) {
      this.warn('No audio producer to toggle');
      return;
    }

    try {
      if (mute) {
        await this.producerState.audioProducer.pause();
        this.log('Audio producer paused');
      } else {
        await this.producerState.audioProducer.resume();
        this.log('Audio producer resumed');
      }
    } catch (error) {
      this.error('Failed to toggle audio:', error);
      throw error;
    }
  }

  /**
   * Pause/Resume video producer
   */
  async handleVideoToggle(disable: boolean): Promise<void> {
    if (!this.producerState.videoProducer) {
      this.warn('No video producer to toggle');
      return;
    }

    try {
      if (disable) {
        await this.producerState.videoProducer.pause();
        this.log('Video producer paused');
      } else {
        await this.producerState.videoProducer.resume();
        this.log('Video producer resumed');
      }
    } catch (error) {
      this.error('Failed to toggle video:', error);
      throw error;
    }
  }

  /**
   * Start screen sharing by creating screen producers
   */
  async handleStartScreenShare(screenStream: MediaStream): Promise<{ screenAudioProducer: Producer | null; screenVideoProducer: Producer | null }> {
    try {
      this.log('Starting screen share with stream');
      
      // 1. Create screen producer transport
      const screenTransport = await this.createProducerTransport();
      
      // 2. Create screen producers (audio + video)
      const screenProducers = await this.createScreenProducers(screenStream, screenTransport);
      
      // 3. Update producer state
      this.producerState.screenAudioProducer = screenProducers.screenAudioProducer;
      this.producerState.screenVideoProducer = screenProducers.screenVideoProducer;
      this.producerState.screenTransport = screenTransport;
      this.producerState.screenStream = screenStream;
      
      this.log('Screen share created successfully:', {
        audio: this.producerState.screenAudioProducer?.id,
        video: this.producerState.screenVideoProducer?.id
      });
      
      return screenProducers;
    } catch (error) {
      this.error('Failed to start screen sharing:', error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async handleStopScreenShare(): Promise<void> {
    try {
      this.log('Stopping screen share');
      
      // Notify server to cleanup and broadcast to other participants
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
      
      if (this.producerState.screenStream) {
        this.producerState.screenStream.getTracks().forEach(track => track.stop());
        this.producerState.screenStream = null;
      }
      
      // Notify server to remove from active speakers and broadcast closure
      if (producerIds.length > 0) {
        this.socket.emit('closeProducers', { producerIds });
        this.log('Notified server of screen share closure:', producerIds);
      }
      
      this.log('Screen share stopped successfully');
    } catch (error) {
      this.error('Failed to stop screen sharing:', error);
      throw error;
    }
  }

  // ==============================
  // Consumer Management Handlers
  // ==============================

  /**
   * Handle new producers by creating consumers
   */
  async handleNewProducer(data: {
    audioPidsToCreate: string[];
    videoPidsToCreate: (string | null)[];
    associatedUserNames: string[];
  }): Promise<void> {
    try {
      this.log('Handling new producer:', data);
      
      await this.requestTransportToConsume(data);
      
      this.log('Successfully consumed new producers');
    } catch (error) {
      this.error('Failed to handle new producer:', error);
      throw error;
    }
  }

  /**
   * Handle consumer pause
   */
  async handleConsumerPaused(data: { consumerId: string; kind: 'audio' | 'video' }): Promise<void> {
    try {
      this.log(`Consumer ${data.kind} paused:`, data.consumerId);
      
      // Find and pause the specific consumer
      for (const [_audioPid, consumerState] of Object.entries(this.consumers)) {
        const consumer = data.kind === 'audio' 
          ? consumerState.audioConsumer 
          : consumerState.videoConsumer;
          
        if (consumer?.id === data.consumerId) {
          await consumer.pause();
          this.log(`Successfully paused ${data.kind} consumer for ${consumerState.userName}`);
          break;
        }
      }
    } catch (error) {
      this.error('Failed to pause consumer:', error);
    }
  }

  /**
   * Handle consumer resume
   */
  async handleConsumerResumed(data: { consumerId: string; kind: 'audio' | 'video' }): Promise<void> {
    try {
      this.log(`Consumer ${data.kind} resumed:`, data.consumerId);
      
      // Find and resume the specific consumer
      for (const [_audioPid, consumerState] of Object.entries(this.consumers)) {
        const consumer = data.kind === 'audio' 
          ? consumerState.audioConsumer 
          : consumerState.videoConsumer;
          
        if (consumer?.id === data.consumerId) {
          await consumer.resume();
          this.log(`Successfully resumed ${data.kind} consumer for ${consumerState.userName}`);
          break;
        }
      }
    } catch (error) {
      this.error('Failed to resume consumer:', error);
    }
  }

  // ==============================
  // Active Speakers Management
  // ==============================

  /**
   * Handle active speakers update
   */
  handleActiveSpeakersUpdate(speakers: string[]): void {
    this.log('Updating active speakers:', speakers);
    
    if (this.activeSpeakersManager) {
      this.activeSpeakersManager.updateActiveSpeakers(speakers);
    } else {
      this.warn('No active speakers manager configured');
    }
  }

  // ==============================
  // Participant Management
  // ==============================

  /**
   * Handle participant leaving
   */
  async handleParticipantLeft(data: { participantId: string; userName: string }): Promise<void> {
    try {
      this.log('Participant left:', data);
      
      // Find and clean up consumers for this participant
      const consumerState = this.consumers[data.participantId];
      if (consumerState) {
        // Close consumers
        if (consumerState.audioConsumer) {
          consumerState.audioConsumer.close();
        }
        if (consumerState.videoConsumer) {
          consumerState.videoConsumer.close();
        }
        
        // Close transport
        if (consumerState.consumerTransport) {
          consumerState.consumerTransport.close();
        }
        
        // Remove from consumers map
        delete this.consumers[data.participantId];
        
        this.log(`Cleaned up resources for participant: ${data.userName}`);
      }
    } catch (error) {
      this.error('Failed to handle participant left:', error);
    }
  }

  /**
   * Handle producer closed (e.g., screen share stopped)
   */
  async handleProducerClosed(data: { producerId: string; userId?: string }): Promise<void> {
    try {
      this.log('Producer closed:', data);
      
      // Find which consumer has this producer
      for (const [audioPid, consumerState] of Object.entries(this.consumers)) {
        const audioMatch = consumerState.audioConsumer?.producerId === data.producerId;
        const videoMatch = consumerState.videoConsumer?.producerId === data.producerId;
        
        if (audioMatch || videoMatch) {
          this.log(`Cleaning up consumer for closed producer ${data.producerId} (${consumerState.userName})`);
          
          // Clear video elements from DOM first
          this.clearVideoElementsForConsumer(consumerState);
          
          // Close the specific consumer that matches
          if (audioMatch && consumerState.audioConsumer) {
            consumerState.audioConsumer.close();
            consumerState.audioConsumer = null;
          }
          if (videoMatch && consumerState.videoConsumer) {
            consumerState.videoConsumer.close();
            consumerState.videoConsumer = null;
          }
          
          // If both consumers are gone, close transport and remove entry
          if (!consumerState.audioConsumer && !consumerState.videoConsumer) {
            if (consumerState.consumerTransport) {
              consumerState.consumerTransport.close();
            }
            delete this.consumers[audioPid];
            this.log(`Removed consumer transport for ${consumerState.userName}`);
          }
          
          break;
        }
      }
    } catch (error) {
      this.error('Failed to handle producer closed:', error);
    }
  }

  /**
   * Clear video elements showing this consumer's stream
   */
  private clearVideoElementsForConsumer(consumerState: ConsumerState): void {
    try {
      // Find all video elements that might be showing this stream
      const remoteVideos = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
      
      for (let i = 0; i < remoteVideos.length; i++) {
        const videoEl = remoteVideos[i];
        if (videoEl.srcObject === consumerState.combinedStream) {
          this.log(`Clearing video element ${i} for ${consumerState.userName}`);
          videoEl.srcObject = null;
          
          // Clear username display
          const usernameEl = document.getElementById(`username-${i}`);
          if (usernameEl) {
            usernameEl.innerHTML = '';
          }
        }
      }
      
      this.log(`Cleared video elements for ${consumerState.userName}`);
    } catch (error) {
      this.warn('Error clearing video elements:', error);
    }
  }

  // ==============================
  // MediaSoup Transport & Media Management (Private Methods)
  // ==============================

  /**
   * Create producer transport
   */
  private async createProducerTransport(): Promise<Transport> {
    interface TransportParams {
      id: string;
      iceParameters: types.IceParameters;
      iceCandidates: types.IceCandidate[];
      dtlsParameters: types.DtlsParameters;
    }

    interface ProduceParameters {
      kind: types.MediaKind;
      rtpParameters: types.RtpParameters;
      appData?: any;
    }

    // Ask the server to make a transport and send params
    const producerTransportParams: TransportParams = await this.socket.emitWithAck('requestTransport', { type: "producer" });
    
    // Use the device to create a front-end transport to send
    const producerTransport = this.device.createSendTransport(producerTransportParams);
    
    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      // Transport connect event will NOT fire until transport.produce() runs
      this.log("Connect running on produce...");
      const connectResp = await this.socket.emitWithAck('connectTransport', { dtlsParameters, type: "producer" });
      this.log(connectResp, "connectResp is back");
      if (connectResp === "success") {
        callback();
      } else if (connectResp === "error") {
        errback(new Error("Connection failed"));
      }
    });
    
    producerTransport.on('produce', async (parameters: ProduceParameters, callback, errback) => {
      this.log("Produce event is now running");
      let { kind, rtpParameters, appData } = parameters;
      
      // Check if this is a screen share producer
      const isScreenShare = appData && (appData as any).source === 'screen';
      let streamKind: string = kind;
      
      if (isScreenShare) {
        // Modify kind to screenAudio or screenVideo for backend storage
        streamKind  = kind === 'audio' ? 'screenAudio' : 'screenVideo';
        this.log(`Screen share detected, using kind: ${streamKind}`);
      }
      
      const produceResp = await this.socket.emitWithAck('startProducing', { kind: streamKind, rtpParameters });
      this.log(produceResp, "produceResp is back!");
      if (produceResp === "error") {
        errback(new Error("Produce failed"));
      } else {
        callback({ id: produceResp });
      }
    });

    return producerTransport;
  }

  /**
   * Create audio and video producers from local stream
   */
  private async createProducer(localStream: MediaStream, producerTransport: Transport): Promise<{ audioProducer: Producer | null; videoProducer: Producer | null }> {
    // Get the audio and video tracks so we can produce
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    
    this.log("Calling produce on video");
    const videoProducer = await producerTransport.produce({ track: videoTrack });
    this.log("Calling produce on audio");
    const audioProducer = await producerTransport.produce({ track: audioTrack });
    this.log("Finished producing!");
    
    return { audioProducer, videoProducer };
  }

  /**
   * Create screen share producers from screen stream
   */
  private async createScreenProducers(screenStream: MediaStream, screenTransport: Transport): Promise<{ screenAudioProducer: Producer | null; screenVideoProducer: Producer | null }> {
    // Get the audio and video tracks from screen share
    const videoTrack = screenStream.getVideoTracks()[0];
    const audioTrack = screenStream.getAudioTracks()[0];
    
    let screenVideoProducer: Producer | null = null;
    let screenAudioProducer: Producer | null = null;
    
    // Screen share always has video
    if (videoTrack) {
      this.log("Creating screen video producer");
      screenVideoProducer = await screenTransport.produce({ 
        track: videoTrack,
        appData: { source: 'screen' }  // Mark as screen share for identification
      });
    }
    
    // Screen share might have audio
    if (audioTrack) {
      this.log("Creating screen audio producer");
      screenAudioProducer = await screenTransport.produce({ 
        track: audioTrack,
        appData: { source: 'screen' }  // Mark as screen share for identification
      });
    }
    
    this.log("Finished screen share producing!");
    
    return { screenAudioProducer, screenVideoProducer };
  }

  /**
   * Create consumer transport for receiving media
   */
  private createConsumerTransport(transportParams: any, audioPid: string): Transport {
    // Make a downstream transport for ONE producer/peer/client (with audio and video producers)
    const consumerTransport = this.device.createRecvTransport(transportParams);
    
    // OPTIMIZATION: Reduce verbose logging for better performance
    consumerTransport.on('connectionstatechange', (state: string) => {
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.warn(`Transport connection state changed to ${state} for ${audioPid}`);
      } else if (state === 'connected') {
        this.log(`Transport connected for ${audioPid}`);
      }
    });
    
    consumerTransport.on('icegatheringstatechange', (state: string) => {
      if (state === 'complete') {
        this.log(`ICE gathering complete for ${audioPid}`);
      } else if (state === 'failed') {
        this.warn(`ICE gathering failed for ${audioPid}`);
      }
    });
    
    // Transport connect listener... fires on .consume()
    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      this.log(`Transport connecting for ${audioPid}`);
      try {
        // OPTIMIZATION: Add timeout to prevent hanging connections
        const connectResp = await Promise.race([
          this.socket.emitWithAck('connectTransport', { dtlsParameters, type: "consumer", audioPid }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 5000))
        ]);
        
        if (connectResp === "success") {
          this.log(`Transport connected successfully for ${audioPid}`);
          callback();
        } else {
          this.error(`Transport connection failed for ${audioPid}:`, connectResp);
          errback(new Error(`Connect failed: ${connectResp}`));
        }
      } catch (error) {
        this.error(`Transport connection error for ${audioPid}:`, error);
        errback(new Error(`Connect failed: ${error}`));
      }
    });
    
    return consumerTransport;
  }

  /**
   * Create a single consumer for audio or video
   */
  private async createConsumer(
    consumerTransport: Transport,
    pid: string | null,
    kind: types.MediaKind,
    _slot: number
  ): Promise<Consumer | null> {
    interface ConsumerParams {
      id: string;
      producerId: string;
      kind: types.MediaKind;
      rtpParameters: types.RtpParameters;
    }

    // Early return if pid is null/undefined (video might not exist)
    if (!pid) {
      this.log(`Skipping ${kind} consumer - no producer ID`);
      return null;
    }

    try {
      // OPTIMIZATION 1: Single call with timeout for faster failure detection
      const consumerParams: ConsumerParams | string = await Promise.race([
        this.socket.emitWithAck('consumeMedia', { rtpCapabilities: this.device.rtpCapabilities, pid, kind }),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('consumeMedia timeout')), 5000))
      ]);

      this.log(`Consumer params for ${kind} ${pid}:`, consumerParams);

      if (consumerParams === "cannotConsume") {
        this.log(`Cannot consume ${kind} for pid ${pid}`);
        return null;
      }

      if (consumerParams === "consumeFailed") {
        this.log(`Consume failed for ${kind} pid ${pid}`);
        return null;
      }

      // OPTIMIZATION 2: Create consumer and unpause in parallel preparation
      const consumer = await consumerTransport.consume(consumerParams as ConsumerParams);
      this.log(`${kind} consume() finished for pid ${pid}`);

      // OPTIMIZATION 3: Immediately unpause after creation for lower latency
      // Fire and forget - don't wait for unpause response
      this.socket.emitWithAck('unpauseConsumer', { pid, kind })
        .then(result => {
          if (result === 'success') {
            this.log(`${kind} consumer ${pid} unpaused successfully`);
          } else {
            this.warn(`Failed to unpause ${kind} consumer ${pid}:`, result);
          }
        })
        .catch(err => this.error(`Unpause error for ${kind} ${pid}:`, err));

      // OPTIMIZATION 4: Return consumer immediately, don't wait for unpause
      return consumer;

    } catch (error) {
      this.error(`Error creating ${kind} consumer for pid ${pid}:`, error);
      return null;
    }
  }

  /**
   * Request transport and create consumers for multiple producers in parallel
   */
  private async requestTransportToConsume(consumeData: {
    audioPidsToCreate: string[];
    videoPidsToCreate: (string | null)[];
    associatedUserNames: string[];
  }): Promise<void> {
    interface TransportParams {
      id: string;
      iceParameters: any;
      iceCandidates: any[];
      dtlsParameters: any;
    }

    interface ConsumerResult {
      audioPid: string;
      userName: string;
      combinedStream: MediaStream;
      consumerTransport: Transport;
      audioConsumer: Consumer | null;
      videoConsumer: Consumer | null;
    }

    // OPTIMIZATION 1: Parallel transport creation instead of sequential
    const transportPromises = consumeData.audioPidsToCreate.map(async (audioPid: string, i: number): Promise<ConsumerResult | null> => {
      const videoPid = consumeData.videoPidsToCreate[i];
      
      try {
        // OPTIMIZATION 2: Request transport creation in parallel
        const consumerTransportParams: TransportParams = await this.socket.emitWithAck('requestTransport', { type: "consumer", audioPid });
        this.log(`Transport params for ${audioPid}:`, consumerTransportParams);
        
        const consumerTransport = this.createConsumerTransport(consumerTransportParams, audioPid);
        
        // OPTIMIZATION 3: Create both consumers in parallel with fast-fail handling
        const [audioConsumer, videoConsumer] = await Promise.all([
          this.createConsumer(consumerTransport, audioPid, 'audio', i).catch(err => {
            this.warn(`Audio consumer failed for ${audioPid}:`, err);
            return null;
          }),
          this.createConsumer(consumerTransport, videoPid, 'video', i).catch(err => {
            this.warn(`Video consumer failed for ${videoPid}:`, err);
            return null;
          })
        ]);
        
        // OPTIMIZATION 4: Only create stream if we have at least one consumer
        if (!audioConsumer && !videoConsumer) {
          this.warn(`No consumers created for ${audioPid}, skipping`);
          return null;
        }
        
        // Create combined stream with available tracks
        const tracks: MediaStreamTrack[] = [];
        if (audioConsumer?.track) tracks.push(audioConsumer.track);
        if (videoConsumer?.track) tracks.push(videoConsumer.track);
        
        const combinedStream = new MediaStream(tracks);
        
        // OPTIMIZATION 5: Immediate DOM update for better UX
        const remoteVideo = document.getElementById(`remote-video-${i}`) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = combinedStream;
          this.log(`Media stream assigned to remote-video-${i}`);
        }
        
        return {
          audioPid,
          userName: consumeData.associatedUserNames[i],
          combinedStream,
          consumerTransport,
          audioConsumer,
          videoConsumer
        };
      } catch (error) {
        this.error(`Failed to create consumers for ${audioPid}:`, error);
        return null;
      }
    });
    
    // OPTIMIZATION 6: Wait for all transports to complete in parallel
    const results = await Promise.all(transportPromises);
    
    // Update consumers map with successful results
    results.forEach(result => {
      if (result) {
        this.consumers[result.audioPid] = {
          combinedStream: result.combinedStream,
          userName: result.userName,
          consumerTransport: result.consumerTransport,
          audioConsumer: result.audioConsumer,
          videoConsumer: result.videoConsumer
        };
      }
    });
    
    this.log(`Successfully created ${results.filter(r => r !== null).length} consumer transports`);
  }

  // ==============================
  // Cleanup & State Management
  // ==============================

  /**
   * Clean up all producers
   */
  async cleanupProducers(): Promise<void> {
    try {
      if (this.producerState.audioProducer) {
        this.producerState.audioProducer.close();
        this.producerState.audioProducer = null;
      }
      
      if (this.producerState.videoProducer) {
        this.producerState.videoProducer.close();
        this.producerState.videoProducer = null;
      }
      
      if (this.producerState.producerTransport) {
        this.producerState.producerTransport.close();
        this.producerState.producerTransport = null;
      }
      
      if (this.producerState.localStream) {
        this.producerState.localStream.getTracks().forEach(track => track.stop());
        this.producerState.localStream = null;
      }
      
      // Clean up screen share producers
      if (this.producerState.screenAudioProducer) {
        this.producerState.screenAudioProducer.close();
        this.producerState.screenAudioProducer = null;
      }
      
      if (this.producerState.screenVideoProducer) {
        this.producerState.screenVideoProducer.close();
        this.producerState.screenVideoProducer = null;
      }
      
      if (this.producerState.screenTransport) {
        this.producerState.screenTransport.close();
        this.producerState.screenTransport = null;
      }
      
      if (this.producerState.screenStream) {
        this.producerState.screenStream.getTracks().forEach(track => track.stop());
        this.producerState.screenStream = null;
      }
      
      this.log('Producer cleanup completed');
    } catch (error) {
      this.error('Error during producer cleanup:', error);
    }
  }

  /**
   * Clean up all consumers
   */
  async cleanupConsumers(): Promise<void> {
    try {
      for (const [_audioPid, consumerState] of Object.entries(this.consumers)) {
        if (consumerState.audioConsumer) {
          consumerState.audioConsumer.close();
        }
        if (consumerState.videoConsumer) {
          consumerState.videoConsumer.close();
        }
        if (consumerState.consumerTransport) {
          consumerState.consumerTransport.close();
        }
      }
      
      // Clear consumers map
      Object.keys(this.consumers).forEach(key => delete this.consumers[key]);
      
      this.log('Consumer cleanup completed');
    } catch (error) {
      this.error('Error during consumer cleanup:', error);
    }
  }

  /**
   * Get current producer state
   */
  getProducerState(): Readonly<ProducerState> {
    return { ...this.producerState };
  }

  /**
   * Get current consumers map
   */
  getConsumers(): Readonly<ConsumersMap> {
    return { ...this.consumers };
  }

  /**
   * Set active speakers manager
   */
  setActiveSpeakersManager(manager: ActiveSpeakersManager): void {
    this.activeSpeakersManager = manager;
  }

  private log(...args: any[]): void {
    console.log('[CallHandlers]', ...args);
  }

  private warn(...args: any[]): void {
    console.warn('[CallHandlers]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[CallHandlers]', ...args);
  }
}
