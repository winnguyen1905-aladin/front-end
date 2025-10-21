import { io, Socket } from 'socket.io-client';

export class FriendClient {
  private socket: Socket;

  constructor(serverUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:8090', username?: string) {
    // Use the /chat namespace with username in auth
    this.socket = io(`${serverUrl}/chat`, {
      transports: ['websocket'],
      reconnection: true,
      auth: {
        username: username
      }
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to chat service (with friend features)');
    });

    this.socket.on('chatConnectionReady', (data: any) => {
      console.log('Chat service ready:', data);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat service');
    });
  }

  async addFriend(userName: string, friendName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('addFriend', 
        { userName, friendName }, 
        (response: any) => {
          if (response.ok) {
            console.log('Friend added:', response.data);
            resolve(response.data);
          } else {
            console.error('Failed to add friend:', response.error);
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  async getFriends(userName: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.socket.emit('getFriends', 
        { userName }, 
        (response: any) => {
          if (response.ok) {
            console.log('Friends list:', response.data.friends);
            resolve(response.data.friends);
          } else {
            console.error('Failed to get friends:', response.error);
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  async removeFriend(userName: string, friendName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('removeFriend', 
        { userName, friendName }, 
        (response: any) => {
          if (response.ok) {
            console.log('Friend removed:', response.data);
            resolve(response.data);
          } else {
            console.error('Failed to remove friend:', response.error);
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  async getUserInfo(userName: string): Promise<{ name: string; lastOnline: string } | null> {
    return new Promise((resolve) => {
      this.socket.emit('getUserInfo', 
        { userName }, 
        (response: any) => {
          if (response.ok) {
            console.log('User info:', response.data);
            resolve(response.data);
          } else {
            console.error('Failed to get user info:', response.error);
            resolve(null);
          }
        }
      );
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

// Example usage:
// import { UserStorage } from '../utils/userStorage';
// const username = UserStorage.getUsername();
// const friendClient = new FriendClient('http://localhost:8080', username);
// await friendClient.addFriend('john', 'jane');
// const friends = await friendClient.getFriends('john');
// const userInfo = await friendClient.getUserInfo('jane');
// console.log('My friends:', friends, 'User info:', userInfo);

