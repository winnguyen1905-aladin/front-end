import { Socket } from 'socket.io-client';
import { CallEventData } from '../response/call';

export interface CallEventHandlers {
  onNewProducer?: (data: CallEventData['newProducer']) => Promise<void>;
  onConsumerPaused?: (data: CallEventData['consumerPaused']) => Promise<void>;
  onConsumerResumed?: (data: CallEventData['consumerResumed']) => Promise<void>;
  onProducerPaused?: (data: CallEventData['producerPaused']) => Promise<void>;
  onProducerResumed?: (data: CallEventData['producerResumed']) => Promise<void>;
  onActiveSpeakersUpdate?: (speakers: string[]) => void;
  onParticipantLeft?: (data: CallEventData['participantLeft']) => Promise<void>;
  onProducerClosed?: (data: { producerId: string; userId?: string }) => Promise<void>;
}

/**
 * Call Event Listeners - Handles socket event listening
 * Separates socket event listening from business logic
 */
export class CallEventListeners {
  private socket: Socket;
  private handlers: CallEventHandlers;

  constructor(socket: Socket, handlers: CallEventHandlers = {}) {
    this.socket = socket;
    this.handlers = handlers;
    this.setupListeners();
  }

  updateHandlers(handlers: Partial<CallEventHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  private setupListeners(): void {
    // Listen for new producers (other participants joining/sharing media)
    this.socket.on('newProducersToConsume', async (data) => {
      this.log('Received newProducersToConsume:', data);
      if (this.handlers.onNewProducer) {
        try {
          await this.handlers.onNewProducer(data);
        } catch (error) {
          this.error('Error handling new producer:', error);
        }
      }
    });

    // Listen for active speakers updates
    this.socket.on('activeSpeakersUpdate', (speakers: string[]) => {
      this.log('Received activeSpeakersUpdate:', speakers);
      if (this.handlers.onActiveSpeakersUpdate) {
        this.handlers.onActiveSpeakersUpdate(speakers);
      }
    });

    // Listen for consumer pause/resume events
    this.socket.on('consumerPaused', async (data) => {
      this.log('Received consumerPaused:', data);
      if (this.handlers.onConsumerPaused) {
        try {
          await this.handlers.onConsumerPaused(data);
        } catch (error) {
          this.error('Error handling consumer paused:', error);
        }
      }
    });

    this.socket.on('consumerResumed', async (data) => {
      this.log('Received consumerResumed:', data);
      if (this.handlers.onConsumerResumed) {
        try {
          await this.handlers.onConsumerResumed(data);
        } catch (error) {
          this.error('Error handling consumer resumed:', error);
        }
      }
    });

    // Listen for producer pause/resume events
    this.socket.on('producerPaused', async (data) => {
      this.log('Received producerPaused:', data);
      if (this.handlers.onProducerPaused) {
        try {
          await this.handlers.onProducerPaused(data);
        } catch (error) {
          this.error('Error handling producer paused:', error);
        }
      }
    });

    this.socket.on('producerResumed', async (data) => {
      this.log('Received producerResumed:', data);
      if (this.handlers.onProducerResumed) {
        try {
          await this.handlers.onProducerResumed(data);
        } catch (error) {
          this.error('Error handling producer resumed:', error);
        }
      }
    });

    // Listen for participant leaving
    this.socket.on('participantLeft', async (data) => {
      this.log('Received participantLeft:', data);
      if (this.handlers.onParticipantLeft) {
        try {
          await this.handlers.onParticipantLeft(data);
        } catch (error) {
          this.error('Error handling participant left:', error);
        }
      }
    });

    // Listen for producer closed (screen share stopped)
    this.socket.on('producerClosed', async (data) => {
      this.log('Received producerClosed:', data);
      if (this.handlers.onProducerClosed) {
        try {
          await this.handlers.onProducerClosed(data);
        } catch (error) {
          this.error('Error handling producer closed:', error);
        }
      }
    });

    // Handle connection state changes
    this.socket.on('disconnect', (reason) => {
      this.warn('Socket disconnected during call:', reason);
    });

    this.socket.on('reconnect', () => {
      this.log('Socket reconnected during call');
    });
  }

  removeAllListeners(): void {
    this.socket.off('newProducersToConsume');
    this.socket.off('activeSpeakersUpdate');
    this.socket.off('consumerPaused');
    this.socket.off('consumerResumed');
    this.socket.off('producerPaused');
    this.socket.off('producerResumed');
    this.socket.off('participantLeft');
    this.socket.off('producerClosed');
  }

  private log(...args: any[]): void {
    console.log('[CallListeners]', ...args);
  }

  private warn(...args: any[]): void {
    console.warn('[CallListeners]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[CallListeners]', ...args);
  }
}
