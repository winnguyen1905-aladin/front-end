// import { io, Socket, SocketOptions } from 'socket.io-client';
 

// // Keys of event signatures that return a Promise (i.e., require ack)
// type KeysWithPromise<T> = {
//   [P in keyof T]-?: T[P] extends (arg: any) => Promise<any> ? P : never;
// }[keyof T];

// import { FallbackToUntypedListener } from '@socket.io/component-emitter';
// import { getAccessTokenCookie } from '@utils/cookie-utils';

// // =============================================================================
// // Reconnection Configuration
// // =============================================================================

// interface ReconnectionConfig {
//   maxAttempts: number;
//   initialDelay: number;
//   maxDelay: number;
//   backoffMultiplier: number;
// }

// const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
//   maxAttempts: 10,
//   initialDelay: 1000, // 1 second
//   maxDelay: 30000, // 30 seconds max
//   backoffMultiplier: 1.5,
// };

// export interface SocketError {

// }

// // =============================================================================
// // Connection State
// // =============================================================================

// export interface ConnectionState {
//   isConnected: boolean;
//   reconnectAttempts: number;
//   lastConnectedAt: number | null;
//   lastDisconnectedAt: number | null;
//   lastError: SocketError | null;
// }

// type ConnectionStateListener = (state: ConnectionState) => void;

// export class SocketService {
//   private readonly defaultTimeout: number = 8000;
//   private socket: Socket | null = null;
//   private namespace: string = '';
//   private options: Partial<SocketOptions> = {};
  
//   // Reconnection state
//   private reconnectionConfig: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG;
//   private reconnectAttempts: number = 0;
//   private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
//   private isManuallyDisconnected: boolean = false;
  
//   // Connection state tracking
//   private connectionState: ConnectionState = {
//     isConnected: false,
//     reconnectAttempts: 0,
//     lastConnectedAt: null,
//     lastDisconnectedAt: null,
//     lastError: null,
//   };
//   private stateListeners: Set<ConnectionStateListener> = new Set();

//   connect(namespace: string, options: Partial<SocketOptions> = {}) {
//     if (this.socket) return;
    
//     this.namespace = namespace;
//     this.options = options;
//     this.isManuallyDisconnected = false;
    
//     this.createSocket();
//   }

//   private createSocket() {
//     this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL + this.namespace, {
//       ...this.options,
//       timeout: this.defaultTimeout,
//       transports: ['websocket', 'polling'],
//       reconnection: true, // We handle reconnection manually for better control,
//       reconnectionAttempts: this.reconnectionConfig.maxAttempts,
//       reconnectionDelay: this.reconnectionConfig.initialDelay,
//       reconnectionDelayMax: this.reconnectionConfig.maxDelay,
//       query: {
//         token: getAccessTokenCookie(),
//       },
//     });

//     this.setupSocketListeners();
//     console.log('[SocketService] Socket created for namespace:', this.namespace);
//   }

//   private setupSocketListeners() {
//     if (!this.socket) return;

//     this.socket.on('connect', () => {
//       console.log('[SocketService] Connected successfully');
//       this.reconnectAttempts = 0;
//       this.clearReconnectTimer();
//       this.updateConnectionState({
//         isConnected: true,
//         reconnectAttempts: 0,
//         lastConnectedAt: Date.now(),
//         lastError: null,
//       });
//     });

//     this.socket.on('disconnect', (reason: string) => {
//       console.log('[SocketService] Disconnected:', reason);
      
//       this.updateConnectionState({
//         isConnected: false,
//         lastDisconnectedAt: Date.now(),
//       });

//       // Don't reconnect if manually disconnected or server initiated disconnect
//       if (this.isManuallyDisconnected || reason === 'io server disconnect') {
//         return;
//       }

//       // Start reconnection for transport errors
//       if (reason === 'transport error' || reason === 'transport close' || reason === 'ping timeout') {
//         this.scheduleReconnect();
//       }
//     });

//     this.socket.on('connect_error', (error: Error) => {
//       console.error('[SocketService] Connection error:', error.message);
      
//       const socketError: SocketError = {
//         message: error.message || 'Socket connection error',
//         code: 'CONNECT_ERROR',
//         details: error,
//       };

//       this.updateConnectionState({
//         isConnected: false,
//         lastError: socketError,
//       });

//       // Schedule reconnect on connection error
//       if (!this.isManuallyDisconnected) {
//         this.scheduleReconnect();
//       }
//     });
//   }

//   private scheduleReconnect() {
//     if (this.reconnectTimer) return; // Already scheduled
//     if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
//       console.warn('[SocketService] Max reconnection attempts reached');
//       this.updateConnectionState({
//         lastError: {
//           message: 'Max reconnection attempts reached. Please refresh the page.',
//           code: 'MAX_RECONNECT_ATTEMPTS',
//         },
//       });
//       return;
//     }

//     // Calculate delay with exponential backoff
//     const delay = Math.min(
//       this.reconnectionConfig.initialDelay * 
//         Math.pow(this.reconnectionConfig.backoffMultiplier, this.reconnectAttempts),
//       this.reconnectionConfig.maxDelay
//     );

//     this.reconnectAttempts++;
    
//     console.log(`[SocketService] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
//     this.updateConnectionState({
//       reconnectAttempts: this.reconnectAttempts,
//     });

//     this.reconnectTimer = setTimeout(() => {
//       this.reconnectTimer = null;
//       this.attemptReconnect();
//     }, delay);
//   }

//   private attemptReconnect() {
//     if (this.isManuallyDisconnected) return;
    
//     console.log(`[SocketService] Attempting reconnect (attempt ${this.reconnectAttempts})`);
    
//     // Destroy old socket and create new one
//     if (this.socket) {
//       this.socket.removeAllListeners();
//       this.socket.disconnect();
//       this.socket = null;
//     }

//     this.createSocket();
//   }

//   private clearReconnectTimer() {
//     if (this.reconnectTimer) {
//       clearTimeout(this.reconnectTimer);
//       this.reconnectTimer = null;
//     }
//   }

//   private updateConnectionState(partial: Partial<ConnectionState>) {
//     this.connectionState = { ...this.connectionState, ...partial };
//     this.stateListeners.forEach(listener => listener(this.connectionState));
//   }

//   // Public API for connection state
//   getConnectionState(): ConnectionState {
//     return { ...this.connectionState };
//   }

//   onConnectionStateChange(listener: ConnectionStateListener): () => void {
//     this.stateListeners.add(listener);
//     // Immediately call with current state
//     listener(this.connectionState);
//     return () => this.stateListeners.delete(listener);
//   }

//   // Force reconnect (can be called from UI)
//   forceReconnect(): void {
//     console.log('[SocketService] Force reconnect requested');
//     this.reconnectAttempts = 0;
//     this.clearReconnectTimer();
//     this.attemptReconnect();
//   }

//   disconnect() {
//     if (!this.socket) return;
//     this.isManuallyDisconnected = true;
//     this.clearReconnectTimer();
//     this.socket.disconnect();
//   }

//   isConnected(): boolean {
//     return this.socket?.connected ?? false;
//   }

//   onceConnected(handler: () => void): void {
//     if (!this.socket) return;
//     if (this.socket.connected) {
//       handler();
//     } else {
//       this.socket.once('connect', handler);
//     }
//   }

//   onError(handler: (error: SocketError) => void): void {
//     if (!this.socket) return;

//     this.socket.on('connect_error', (error: Error) => {
//       const socketError: SocketError = {
//         message: error.message || 'Socket connection error',
//         code: 'CONNECT_ERROR',
//         details: error,
//       };
//       handler(socketError);
//     });

//     this.socket.on('disconnect', (reason: string) => {
//       if (reason === 'io server disconnect' || reason === 'io client disconnect') {
//         // These are normal disconnections
//         return;
//       }

//       const socketError: SocketError = {
//         message: `Socket disconnected: ${reason}`,
//         code: 'DISCONNECT_ERROR',
//         details: { reason },
//       };
//       handler(socketError);
//     });
//   }

//   destroy(): void {
//     this.clearReconnectTimer();
//     this.stateListeners.clear();
//     this.disconnect();
//   }
// }
