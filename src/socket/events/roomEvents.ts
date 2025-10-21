import { SocketClient } from '../socket-client';
import { ActiveSpeakersUpdate, NewProducersData, UserLeftData, ProducerClosedData } from '../types/events';

export interface RoomEventHandlers {
  onActiveSpeakersUpdate?: (speakers: string[]) => void;
  onNewProducers?: (data: NewProducersData) => void;
  onUserLeft?: (data: UserLeftData) => void;
  onProducerClosed?: (data: ProducerClosedData) => void;
  onRoomFull?: () => void;
  onRoomClosed?: () => void;
}

export class RoomEventManager {
  private socketClient: SocketClient;
  private handlers: RoomEventHandlers;

  constructor(socketClient: SocketClient, handlers: RoomEventHandlers = {}) {
    this.socketClient = socketClient;
    this.handlers = handlers;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Active speakers updated
    this.socketClient.on('updateActiveSpeakers', (data: string[] | ActiveSpeakersUpdate) => {
      // Handle both old format (string[]) and new format (ActiveSpeakersUpdate)
      const speakers = Array.isArray(data) ? data : data.activeSpeakers;
      
      this.log('Active speakers updated:', speakers);
      if (this.handlers.onActiveSpeakersUpdate) {
        this.handlers.onActiveSpeakersUpdate(speakers);
      }
    });

    // New producers available for consumption
    this.socketClient.on('newProducersToConsume', (data: NewProducersData) => {
      this.log('New producers to consume:', data);
      if (this.handlers.onNewProducers) {
        this.handlers.onNewProducers(data);
      }
    });

    // Producer was closed
    this.socketClient.on('producerClosed', (data: ProducerClosedData) => {
      this.log('Producer closed:', data);
      if (this.handlers.onProducerClosed) {
        this.handlers.onProducerClosed(data);
      }
    });

    // User left the room
    this.socketClient.on('userLeft', (data: UserLeftData) => {
      this.log('User left room:', data);
      if (this.handlers.onUserLeft) {
        this.handlers.onUserLeft(data);
      }
    });

    // Room is full
    this.socketClient.on('roomFull', () => {
      this.warn('Room is full');
      if (this.handlers.onRoomFull) {
        this.handlers.onRoomFull();
      }
    });

    // Room was closed
    this.socketClient.on('roomClosed', () => {
      this.warn('Room was closed');
      if (this.handlers.onRoomClosed) {
        this.handlers.onRoomClosed();
      }
    });
  }

  updateHandlers(handlers: Partial<RoomEventHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // ==============================
  // Client-to-Server Events
  // ==============================

  async joinRoom(userName: string, roomName: string): Promise<any> {
    try {
      this.log('Joining room:', { userName, roomName });
      const response = await this.socketClient.emitWithAck('joinRoom', { userName, roomName });
      this.log('Join room response:', response);
      return response;
    } catch (error) {
      this.error('Failed to join room:', error);
      throw error;
    }
  }

  leaveRoom(): void {
    this.log('Leaving room');
    this.socketClient.emit('leaveRoom');
  }

  sendAudioChange(action: 'mute' | 'unmute'): void {
    this.log('Audio change:', action);
    this.socketClient.emit('audioChange', { action });
  }

  sendVideoChange(action: 'enable' | 'disable'): void {
    this.log('Video change:', action);
    this.socketClient.emit('videoChange', action);
  }

  private log(...args: any[]): void {
    console.log('[RoomEvents]', ...args);
  }

  private warn(...args: any[]): void {
    console.warn('[RoomEvents]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[RoomEvents]', ...args);
  }
}
