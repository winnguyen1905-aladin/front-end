import { SocketClient } from '../socket-client';
import { SocketError } from '../types/events';

export interface ConnectionEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: SocketError) => void;
}

export class ConnectionEventManager {
  private socketClient: SocketClient;
  private handlers: ConnectionEventHandlers;

  constructor(socketClient: SocketClient, handlers: ConnectionEventHandlers = {}) {
    this.socketClient = socketClient;
    this.handlers = handlers;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Connection established
    this.socketClient.on('connect', () => {
      this.log('Socket connected:', this.socketClient.id);
      if (this.handlers.onConnect) {
        this.handlers.onConnect();
      }
    });

    // Connection lost
    this.socketClient.on('disconnect', (reason: string) => {
      this.warn('Socket disconnected:', reason);
      if (this.handlers.onDisconnect) {
        this.handlers.onDisconnect(reason);
      }
    });

    // Connection error
    this.socketClient.on('connect_error', (error: Error) => {
      const socketError: SocketError = {
        message: error?.message || 'Socket connection error',
        code: 'CONNECT_ERROR',
        details: error,
      };
      this.error('Socket connect_error:', socketError.message);
      if (this.handlers.onError) {
        this.handlers.onError(socketError);
      }
    });
  }

  updateHandlers(handlers: Partial<ConnectionEventHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  private log(...args: any[]): void {
    console.log('[SocketConnection]', ...args);
  }

  private warn(...args: any[]): void {
    console.warn('[SocketConnection]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[SocketConnection]', ...args);
  }
}
