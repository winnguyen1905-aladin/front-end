// Internal imports for use within this file
import { Device } from 'mediasoup-client';
import { SocketClient } from './socket-client';
import { ConnectionEventManager, type ConnectionEventHandlers } from './events/connectionEvents';
import { RoomEventManager, type RoomEventHandlers } from './events/roomEvents';
import { CallManager, type CallManagerOptions } from './call';
import { ChatEventManager, type ChatEventHandlers } from './chat';

// Re-exports for external use
export { Device } from 'mediasoup-client';
export { SocketClient } from './socket-client';
export { ConnectionEventManager, type ConnectionEventHandlers } from './events/connectionEvents';
export { RoomEventManager, type RoomEventHandlers } from './events/roomEvents';
export { CallManager, type CallManagerOptions, type ConsumersMap, type ProducerState } from './call';
export { ChatEventManager, type ChatEventHandlers } from './chat';

// Types
export * from './types/events';
export * from './chat';

// Main socket manager that combines all event managers
export class SocketManager {
  private socketClient: SocketClient;
  private connectionManager: ConnectionEventManager;
  private roomManager: RoomEventManager;
  private callManager: CallManager;
  private chatManager: ChatEventManager;

  constructor(
    serverUrl: string = import.meta.env.VITE_SERVER_URL || 'http://localhost:8090',
    options?: {
      connectionHandlers?: ConnectionEventHandlers;
      roomHandlers?: RoomEventHandlers;
      callOptions?: CallManagerOptions;
      chatHandlers?: ChatEventHandlers;
      namespace?: string;
      username?: string;
    }
  ) {
    // Default to /chat namespace for chat features, or use provided namespace
    const namespace = options?.namespace ?? '/chat';
    const username = options?.username;
    
    // Prepare auth data if username is provided
    const auth = username ? { username } : undefined;
    
    // Create socket client with auth data
    this.socketClient = new SocketClient(serverUrl, namespace, auth);
    
    if (username) {
      console.log(`[SocketManager] Initialized with username: ${username} on namespace: ${namespace}`);
    }
    
    this.connectionManager = new ConnectionEventManager(
      this.socketClient, 
      options?.connectionHandlers
    );
    
    this.roomManager = new RoomEventManager(
      this.socketClient, 
      options?.roomHandlers
    );
    
    this.chatManager = new ChatEventManager(
      this.socketClient,
      options?.chatHandlers
    );
    
    // CallManager will be created when device is set
    this.callManager = null as any;
  }

  setDevice(device: Device, callOptions?: CallManagerOptions): void {
    this.callManager = new CallManager(
      this.socketClient.getSocket(),
      device,
      callOptions || {}
    );
  }

  // Getters for each manager
  get connection(): ConnectionEventManager {
    return this.connectionManager;
  }

  get room(): RoomEventManager {
    return this.roomManager;
  }

  get call(): CallManager {
    return this.callManager;
  }

  get chat(): ChatEventManager {
    return this.chatManager;
  }

  get client(): SocketClient {
    return this.socketClient;
  }

  // Connection management
  connect(): void {
    this.socketClient.connect();
  }

  disconnect(): void {
    this.socketClient.disconnect();
  }

  get connected(): boolean {
    return this.socketClient.connected;
  }

  get id(): string | undefined {
    return this.socketClient.id;
  }

  // Update handlers
  updateConnectionHandlers(handlers: Partial<ConnectionEventHandlers>): void {
    this.connectionManager.updateHandlers(handlers);
  }

  updateRoomHandlers(handlers: Partial<RoomEventHandlers>): void {
    this.roomManager.updateHandlers(handlers);
  }

  updateChatHandlers(handlers: Partial<ChatEventHandlers>): void {
    this.chatManager.updateHandlers(handlers);
  }

  // Cleanup
  destroy(): void {
    // Cleanup call manager if it exists
    if (this.callManager) {
      this.callManager.destroy();
    }
    
    // Cleanup chat manager
    if (this.chatManager) {
      this.chatManager.destroy();
    }
    
    this.socketClient.destroy();
  }
}
