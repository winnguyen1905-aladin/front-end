import { io, Socket } from 'socket.io-client';
import { 
  ServerToClientEvents, 
  ClientToServerEvents,
  SocketError,
  SocketTimeoutError 
} from './types/events';
import { env, isDebugEnabled } from '../config/env';

export class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private readonly defaultTimeout: number = 8000;

  constructor(
    serverUrl: string = env.SOCKET_URL, 
    namespace: string = '/',
    auth?: Record<string, any>
  ) {
    // Append namespace to server URL if not root
    const fullUrl = namespace === '/' ? serverUrl : `${serverUrl}${namespace}`;
    
    this.socket = io(fullUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      timeout: this.defaultTimeout,
      auth: auth || {}, // Pass auth during construction
    });
    
    // Debug logging only in debug mode
    if (isDebugEnabled()) {
      console.log(`[SocketClient] Connecting to: ${fullUrl}`, auth ? `with auth: ${JSON.stringify(auth)}` : '');
    }
  }

  // ==============================
  // Connection Management
  // ==============================

  connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  // ==============================
  // Event Listeners
  // ==============================

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    // @ts-ignore - Socket.IO typing complexity workaround
    this.socket.on(event, handler);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K]
  ): void {
    if (handler) {
      // @ts-ignore - Socket.IO typing complexity workaround
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  once<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ): void {
    // @ts-ignore - Socket.IO typing complexity workaround
    this.socket.once(event, handler);
  }

  removeAllListeners<K extends keyof ServerToClientEvents>(event?: K): void {
    if (event) {
      this.socket.removeAllListeners(event);
    } else {
      this.socket.removeAllListeners();
    }
  }

  // ==============================
  // Event Emission
  // ==============================

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    // @ts-ignore - TypeScript has trouble with the spread args here
    this.socket.emit(event, ...args);
  }

  async emitWithAck<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0],
    timeoutMs: number = this.defaultTimeout
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error: SocketTimeoutError = {
          message: `Socket acknowledgment timeout for event: ${String(event)}`,
          code: 'SOCKET_TIMEOUT',
          timeout: timeoutMs,
          event: String(event),
        };
        reject(error);
      }, timeoutMs);

      // @ts-ignore - Socket.IO typing complexity workaround for emit with ack
      this.socket.emit(event, data, (response: any) => {
        clearTimeout(timeout);
        
        console.log(`[SocketClient] ${String(event)} response:`, response);
        
        // Check if response indicates an error
        if (response && response.ok === false) {
          // Handle error - could be string or object
          let errorMessage = 'Socket operation failed';
          let errorCode = 'SOCKET_ERROR';
          let errorDetails = undefined;
          
          if (typeof response.error === 'string') {
            errorMessage = response.error;
          } else if (typeof response.error === 'object' && response.error !== null) {
            errorMessage = response.error.message || errorMessage;
            errorCode = response.error.code || errorCode;
            errorDetails = response.error.details;
          }
          
          console.error(`[SocketClient] ${String(event)} error:`, errorMessage);
          
          const error: SocketError = {
            message: errorMessage,
            code: errorCode,
            details: errorDetails,
          };
          reject(error);
          return;
        }
        
        resolve(response);
      });
    });
  }

  // ==============================
  // Utility Methods
  // ==============================

  isConnected(): boolean {
    return this.socket.connected;
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return this.socket;
  }

  // ==============================
  // Error Handling
  // ==============================

  onError(handler: (error: SocketError) => void): void {
    this.socket.on('connect_error', (error: Error) => {
      const socketError: SocketError = {
        message: error.message || 'Socket connection error',
        code: 'CONNECT_ERROR',
        details: error,
      };
      handler(socketError);
    });

    this.socket.on('disconnect', (reason: string) => {
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // These are normal disconnections
        return;
      }
      
      const socketError: SocketError = {
        message: `Socket disconnected: ${reason}`,
        code: 'DISCONNECT_ERROR',
        details: { reason },
      };
      handler(socketError);
    });
  }

  // ==============================
  // Cleanup
  // ==============================

  destroy(): void {
    this.removeAllListeners();
    this.disconnect();
  }
}
