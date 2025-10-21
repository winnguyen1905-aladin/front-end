import { Device } from 'mediasoup-client';
import { Socket } from 'socket.io-client';

import { 
  CallEventListeners, 
  CallEventHandlers as ListenerHandlers
} from './listeners';

import { 
  CallEventHandlers,
  ConsumersMap,
  ProducerState,
  ActiveSpeakersManager 
} from './handlers';

// Re-export types for external use
export type { ConsumersMap, ProducerState, ActiveSpeakersManager } from './handlers';
export type { CallEventData } from '../response/call';

export interface CallManagerOptions {
  activeSpeakersManager?: ActiveSpeakersManager;
  onCallStateChange?: (state: 'idle' | 'connecting' | 'connected' | 'disconnected') => void;
  onError?: (error: Error) => void;
}

/**
 * Main Call Manager
 * Orchestrates call events by connecting listeners to handlers
 * Provides high-level API for call operations
 */
export class CallManager {
  private listeners: CallEventListeners;
  private handlers: CallEventHandlers;
  private consumers: ConsumersMap = {};
  private options: CallManagerOptions;
  private callState: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';

  constructor(
    socket: Socket, 
    device: Device, 
    options: CallManagerOptions = {}
  ) {
    this.options = options;
    
    // Initialize handlers
    this.handlers = new CallEventHandlers(
      socket,
      device,
      this.consumers,
      options.activeSpeakersManager
    );

    // Initialize listeners with handlers bound
    this.listeners = new CallEventListeners(socket, this.createListenerHandlers());
  }

  // ==============================
  // Public API - Producer Operations
  // ==============================

  /**
   * Start producing local media (audio + video)
   */
  async startProducing(localStream: MediaStream): Promise<ProducerState> {
    try {
      this.setCallState('connecting');
      const producerState = await this.handlers.handleStartProducing(localStream);
      this.setCallState('connected');
      return producerState;
    } catch (error) {
      this.setCallState('disconnected');
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Toggle audio mute/unmute
   */
  async toggleAudio(mute: boolean): Promise<void> {
    try {
      await this.handlers.handleAudioToggle(mute);
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Toggle video enable/disable
   */
  async toggleVideo(disable: boolean): Promise<void> {
    try {
      await this.handlers.handleVideoToggle(disable);
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(screenStream: MediaStream): Promise<{ screenAudioProducer: any; screenVideoProducer: any }> {
    try {
      this.log('Starting screen share');
      const result = await this.handlers.handleStartScreenShare(screenStream);
      this.log('Screen share started successfully');
      return result;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    try {
      this.log('Stopping screen share');
      await this.handlers.handleStopScreenShare();
      this.log('Screen share stopped successfully');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // ==============================
  // Public API - State Access
  // ==============================

  /**
   * Get current producer state
   */
  getProducerState(): Readonly<ProducerState> {
    return this.handlers.getProducerState();
  }

  /**
   * Get current consumers
   */
  getConsumers(): Readonly<ConsumersMap> {
    return this.handlers.getConsumers();
  }

  /**
   * Get current call state
   */
  getCallState(): 'idle' | 'connecting' | 'connected' | 'disconnected' {
    return this.callState;
  }

  // ==============================
  // Public API - Configuration
  // ==============================

  /**
   * Update active speakers manager
   */
  setActiveSpeakersManager(manager: ActiveSpeakersManager): void {
    this.handlers.setActiveSpeakersManager(manager);
  }

  /**
   * Update listener handlers (for dynamic behavior changes)
   */
  updateListenerHandlers(handlers: Partial<ListenerHandlers>): void {
    this.listeners.updateHandlers(handlers);
  }

  // ==============================
  // Call Lifecycle Management
  // ==============================

  /**
   * End the call and cleanup all resources
   */
  async endCall(): Promise<void> {
    try {
      this.setCallState('disconnected');
      
      // Cleanup producers and consumers
      await Promise.all([
        this.handlers.cleanupProducers(),
        this.handlers.cleanupConsumers()
      ]);
      
      this.log('Call ended successfully');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Cleanup and remove all listeners
   */
  destroy(): void {
    try {
      this.listeners.removeAllListeners();
      this.setCallState('idle');
      this.log('Call manager destroyed');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  // ==============================
  // Private Methods
  // ==============================

  /**
   * Create bound handler methods for listeners
   */
  private createListenerHandlers(): ListenerHandlers {
    return {
      onNewProducer: async (data) => {
        if (data) {
          await this.handlers.handleNewProducer(data);
        }
      },

      onConsumerPaused: async (data) => {
        if (data) {
          await this.handlers.handleConsumerPaused(data);
        }
      },

      onConsumerResumed: async (data) => {
        if (data) {
          await this.handlers.handleConsumerResumed(data);
        }
      },

      onProducerPaused: async (data) => {
        if (data) {
          // Handle producer paused if needed
          this.log('Producer paused:', data);
        }
      },

      onProducerResumed: async (data) => {
        if (data) {
          // Handle producer resumed if needed
          this.log('Producer resumed:', data);
        }
      },

      onActiveSpeakersUpdate: (speakers) => {
        this.handlers.handleActiveSpeakersUpdate(speakers);
      },

      onParticipantLeft: async (data) => {
        if (data) {
          await this.handlers.handleParticipantLeft(data);
        }
      },

      onProducerClosed: async (data) => {
        if (data) {
          await this.handlers.handleProducerClosed(data);
        }
      }
    };
  }

  /**
   * Set call state and notify if callback provided
   */
  private setCallState(state: 'idle' | 'connecting' | 'connected' | 'disconnected'): void {
    if (this.callState !== state) {
      this.callState = state;
      this.log(`Call state changed to: ${state}`);
      
      if (this.options.onCallStateChange) {
        this.options.onCallStateChange(state);
      }
    }
  }

  /**
   * Handle errors with optional callback
   */
  private handleError(error: Error): void {
    this.error('Call error:', error.message);
    
    if (this.options.onError) {
      this.options.onError(error);
    }
  }

  private log(...args: any[]): void {
    console.log('[CallManager]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[CallManager]', ...args);
  }
}

// Export main class and types
export default CallManager;
