import React, { useState, useEffect, useRef } from 'react';
import { SocketManager } from '@socket/socket-manager';
import type { GlobalMessage, NewGlobalMessageData, GlobalTypingIndicatorData } from '@socket/socket-manager';
import { UserStorage } from '../../utils/userStorage';

interface GlobalChatPageProps {
  currentUserName: string;
  onLogout?: () => void;
}

export const GlobalChatPage: React.FC<GlobalChatPageProps> = ({ currentUserName, onLogout }) => {
  const username = currentUserName || UserStorage.getUsername() || '';
  
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const socketManagerRef = useRef<SocketManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUsersTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize socket manager
  useEffect(() => {
    if (!username) {
      console.error('❌ Cannot initialize socket without username');
      return;
    }

    console.log('🌍 Initializing global chat with username:', username);
    
    const chatHandlers = {
      onNewGlobalMessage: (data: NewGlobalMessageData) => {
        console.log('🌍✅ NEW GLOBAL MESSAGE RECEIVED:', data);
        console.log('🌍✅ Message content:', data.message.content);
        console.log('🌍✅ From user:', data.message.senderName);
        setMessages(prev => [...prev, data.message]);
      },

      onGlobalTypingIndicator: (data: GlobalTypingIndicatorData) => {
        console.log('⌨️ Global typing:', data);
        const typingUser = data.userName;
        
        if (typingUser === username) return; // Ignore own typing
        
        if (data.isTyping) {
          setTypingUsers(prev => new Set(prev).add(typingUser));
          
          // Clear existing timeout for this user
          const existingTimeout = typingUsersTimeouts.current.get(typingUser);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          
          // Set new timeout to remove typing indicator after 3 seconds
          const timeout = setTimeout(() => {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(typingUser);
              return newSet;
            });
            typingUsersTimeouts.current.delete(typingUser);
          }, 3000);
          
          typingUsersTimeouts.current.set(typingUser, timeout);
        } else {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(typingUser);
            return newSet;
          });
          
          const existingTimeout = typingUsersTimeouts.current.get(typingUser);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            typingUsersTimeouts.current.delete(typingUser);
          }
        }
      },
    };

    socketManagerRef.current = new SocketManager(process.env.SERVER_URL, {
      chatHandlers,
      username: username,
      namespace: '/chat', // Explicitly set namespace
    });

    // Add connection event logging
    const socket = socketManagerRef.current.client.getSocket();
    const rawSocket = socket as any; // Cast to any to listen to custom events
    
    socket.on('connect', () => {
      console.log('🌍✅ Socket connected to global chat!', socket.id);
    });
    
    // Listen for raw chatConnectionReady event (not typed in interface)
    rawSocket.on('chatConnectionReady', (data: any) => {
      console.log('🌍✅ Chat connection ready:', data);
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('🌍❌ Socket disconnected:', reason);
    });
    
    socket.on('connect_error', (error: Error) => {
      console.error('🌍❌ Connection error:', error);
    });

    socketManagerRef.current.connect();
    console.log('🌍 Socket manager created and connecting...');

    // Load global chat history
    loadGlobalChatHistory();

    return () => {
      console.log('🌍 Cleaning up global chat connection');
      if (socketManagerRef.current) {
        socketManagerRef.current.destroy();
      }
      
      // Clear all typing timeouts
      typingUsersTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingUsersTimeouts.current.clear();
    };
  }, [username]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadGlobalChatHistory = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for connection
      
      if (!socketManagerRef.current) return;

      const response = await socketManagerRef.current.client.emitWithAck('chat:getGlobalHistory', {
        limit: 100,
        offset: 0,
      });

      if (response && response.messages) {
        setMessages(response.messages);
        console.log('✅ Global chat history loaded:', response.messages.length, 'messages');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load global chat history:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !socketManagerRef.current) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');

    // Stop typing indicator
    handleStopTyping();

    try {
      console.log('🌍📤 Sending global message:', messageContent);
      
      const response = await socketManagerRef.current.client.emitWithAck('chat:sendGlobalMessage', {
        content: messageContent,
        messageType: 'text',
        timestamp: Date.now(),
      });

      console.log('🌍📥 Send response:', response);

      if (response && response.ok && response.data && response.data.success) {
        console.log('🌍✅ Global message sent successfully:', response.data.message);
        // Message will be added via socket event broadcast
      } else {
        console.error('🌍❌ Send failed:', response);
      }
    } catch (error) {
      console.error('🌍❌ Failed to send global message:', error);
      alert('Failed to send message: ' + (error as any).message);
    }
  };

  const handleTyping = () => {
    if (!socketManagerRef.current) return;

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketManagerRef.current.client.emit('chat:globalTyping', {
        isTyping: true,
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  };

  const handleStopTyping = () => {
    if (!socketManagerRef.current || !isTyping) return;

    setIsTyping(false);
    socketManagerRef.current.client.emit('chat:globalTyping', {
      isTyping: false,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getTypingText = () => {
    const users = Array.from(typingUsers);
    if (users.length === 0) return null;
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users[0]}, ${users[1]}, and ${users.length - 2} others are typing...`;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                  🌍
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Global Chat</h2>
                  <p className="text-sm text-gray-500">
                    Public channel • Everyone can chat
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Logged in as: <span className="font-semibold text-blue-600">{username}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                  title="Logout"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-gray-100">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🌍</div>
                <p className="text-gray-400 text-lg">Welcome to Global Chat!</p>
                <p className="text-gray-500 text-sm mt-2">Be the first to send a message</p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.senderName === username;
              const showAvatar = index === 0 || messages[index - 1].senderName !== message.senderName;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-xl`}>
                    {/* Avatar */}
                    {!isMine && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {showAvatar ? message.senderName.charAt(0).toUpperCase() : ''}
                      </div>
                    )}
                    
                    {/* Message Bubble */}
                    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {/* Sender Name (for others' messages) */}
                      {!isMine && showAvatar && (
                        <span className="text-xs font-semibold text-gray-600 mb-1 px-1">
                          {message.senderName}
                        </span>
                      )}
                      
                      {/* Message Content */}
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isMine
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                            : 'bg-white text-gray-900 rounded-bl-none shadow-sm border border-gray-100'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div className="flex items-center justify-end mt-1">
                          <span className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8"></div>
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-500 italic">{getTypingText()}</p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message to everyone..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalChatPage;

