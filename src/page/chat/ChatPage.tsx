import React, { useState, useEffect, useRef } from 'react';
import { SocketManager, ChatEventHandlers } from '@socket/socket-manager';
import type { Message, NewMessageData } from '@socket/socket-manager';
import { UserStorage } from '../../utils/userStorage';

interface Contact {
  id: string;
  name: string;
  lastMessage?: string;
  unreadCount?: number;
  online?: boolean;
}

interface ChatPageProps {
  currentUserName: string;
  onLogout?: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ currentUserName, onLogout }) => {
  // Fix: Get username from localStorage if prop is undefined
  const username = currentUserName || UserStorage.getUsername() || '';

  console.log('💡 ChatPage - Props username:', currentUserName);
  console.log('💡 ChatPage - localStorage username:', UserStorage.getUsername());
  console.log('💡 ChatPage - Using username:', username);

  if (!username) {
    console.error('❌ ChatPage - No username available! Redirecting...');
  }

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const socketManagerRef = useRef<SocketManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket manager
  useEffect(() => {
    console.log('🔌 Initializing socket connection with username:', username);

    if (!username) {
      console.error('❌ Cannot initialize socket without username');
      return;
    }

    const chatHandlers: ChatEventHandlers = {
      onNewMessage: (data: NewMessageData) => {
        console.log('New message received:', data);

        // Add message to the list
        setMessages(prev => [...prev, data.message]);

        // Mark as read if chat is open
        if (selectedContact && data.chatId === selectedContact.id) {
          socketManagerRef.current?.client.emitWithAck('chat:markRead', {
            messageIds: [data.message.id],
            chatId: data.chatId,
          }).catch(err => console.error('Failed to mark as read:', err));
        }
      },

      onTypingIndicator: (data) => {
        if (selectedContact && data.chatId === selectedContact.id) {
          if (data.isTyping) {
            setTypingUser(data.userName);
          } else {
            setTypingUser(null);
          }
        }
      },

      onMessageEdited: (data) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.messageId
              ? { ...msg, content: data.newContent, isEdited: true, editedAt: data.editedAt }
              : msg
          )
        );
      },

      onMessageDeleted: (data) => {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      },

      onMessagesRead: (data) => {
        console.log('Messages read:', data);
        // TODO: Update UI to show read receipts
      },
    };

    socketManagerRef.current = new SocketManager(process.env.SERVER_URL, {
      chatHandlers,
      username: username,
    });

    socketManagerRef.current.connect();

    // Load friends from Redis after connection
    loadFriendsFromRedis();

    return () => {
      console.log('🔌 Cleaning up socket connection');
      if (socketManagerRef.current) {
        socketManagerRef.current.destroy();
      }
    };
  }, [username]); // Only re-initialize if username changes

  // Load friends from Redis
  const loadFriendsFromRedis = async () => {
    try {
      setLoadingFriends(true);
      console.log('👥 Loading friends for user:', username);

      // Wait a bit for socket to connect
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!socketManagerRef.current) {
        console.warn('⚠️ Socket manager not initialized');
        return;
      }

      console.log('📡 Emitting getFriends event...');
      const socket = socketManagerRef.current.client.getSocket();

      // Use raw socket emit with callback (bypassing TypeScript strict typing)
      const response = await new Promise<any>((resolve, reject) => {
        (socket as any).emit('getFriends',
          { userName: username },
          (response: any) => {
            console.log('📥 getFriends response:', response);
            if (response.ok) {
              resolve(response.data);
            } else {
              reject(new Error(response.error || 'Unknown error'));
            }
          }
        );
      });

      if (response.friends && Array.isArray(response.friends)) {
        const friendContacts: Contact[] = response.friends.map((friendName: string) => ({
          id: `friend_${friendName}`,
          name: friendName,
          online: false, // Will be updated by presence system
          unreadCount: 0,
        }));
        setContacts(friendContacts);
        console.log('✅ Friends loaded from Redis:', response.friends);
      } else {
        console.log('ℹ️ No friends found or empty list');
        setContacts([]);
      }
    } catch (error) {
      console.error('❌ Failed to load friends:', error);
      setContacts([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Add new friend
  const handleAddFriend = async () => {
    if (!newFriendName.trim() || !socketManagerRef.current) return;

    try {
      const socket = socketManagerRef.current.client.getSocket();

      const response = await new Promise<any>((resolve, reject) => {
        (socket as any).emit('addFriend',
          { userName: username, friendName: newFriendName.trim() },
          (response: any) => {
            if (response.ok) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      if (response.success) {
        console.log('✅ Friend added:', response.message);
        setNewFriendName('');
        setShowAddFriend(false);

        // Reload friends list
        await loadFriendsFromRedis();
      }
    } catch (error: any) {
      console.error('❌ Failed to add friend:', error.message);
      alert(`Failed to add friend: ${error.message}`);
    }
  };

  // Remove friend
  const handleRemoveFriend = async (friendName: string) => {
    if (!confirm(`Remove ${friendName} from friends?`)) return;

    try {
      const socket = socketManagerRef.current!.client.getSocket();

      const response = await new Promise<any>((resolve, reject) => {
        (socket as any).emit('removeFriend',
          { userName: username, friendName },
          (response: any) => {
            if (response.ok) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      if (response.success) {
        console.log('✅ Friend removed:', response.message);

        // Reload friends list
        await loadFriendsFromRedis();

        // Clear selected contact if removed
        if (selectedContact?.name === friendName) {
          setSelectedContact(null);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to remove friend:', error.message);
      alert(`Failed to remove friend: ${error.message}`);
    }
  };

  // Load chat history when a contact is selected
  useEffect(() => {
    if (selectedContact && socketManagerRef.current) {
      loadChatHistory(selectedContact.id);
    }
  }, [selectedContact]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await socketManagerRef.current?.client.emitWithAck('chat:getHistory', {
        chatId,
        limit: 50,
        offset: 0,
      });

      if (response) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // For demo purposes, show empty chat
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedContact || !socketManagerRef.current) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');

    // Stop typing indicator
    handleStopTyping();

    try {
      const response = await socketManagerRef.current.client.emitWithAck('chat:sendMessage', {
        recipientId: selectedContact.id,
        content: messageContent,
        messageType: 'text',
        timestamp: Date.now(),
      });

      if (response.success) {
        setMessages(prev => [...prev, response.message]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Optionally show error notification
    }
  };

  const handleTyping = () => {
    if (!selectedContact || !socketManagerRef.current) return;

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketManagerRef.current.client.emit('chat:typing', {
        recipientId: selectedContact.id,
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
    if (!selectedContact || !socketManagerRef.current || !isTyping) return;

    setIsTyping(false);
    socketManagerRef.current.client.emit('chat:typing', {
      recipientId: selectedContact.id,
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
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Contacts List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Friends</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddFriend(!showAddFriend)}
                className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                title="Add Friend"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                  title="Logout"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-blue-100 mt-1">Logged in as: {username}</p>
        </div>

        {/* Add Friend Form */}
        {showAddFriend && (
          <div className="p-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddFriend();
                  }
                }}
                placeholder="Friend's name..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddFriend}
                disabled={!newFriendName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search friends..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          {loadingFriends ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">Loading friends...</div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <div className="text-gray-400 mb-2">No friends yet</div>
              <button
                onClick={() => setShowAddFriend(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first friend
              </button>
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className={`group relative p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedContact?.id === contact.id ? 'bg-blue-50' : ''
                  }`}
              >
                <div
                  onClick={() => setSelectedContact(contact)}
                  className="flex items-center space-x-3"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    {contact.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {contact.name}
                      </p>
                      {contact.unreadCount! > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                    {contact.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">{contact.lastMessage}</p>
                    )}
                  </div>
                </div>

                {/* Remove Friend Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFriend(contact.name);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-full transition-all"
                  title="Remove friend"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold">
                  {selectedContact.name.charAt(0)}
                </div>
                {selectedContact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedContact.name}</h2>
                <p className="text-sm text-gray-500">
                  {selectedContact.online ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No messages yet. Start a conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId === 'me'; // Replace with actual user ID
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl ${isMine
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-gray-900 rounded-bl-none shadow-sm'
                          }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <span className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                            {formatTime(message.timestamp)}
                          </span>
                          {message.isEdited && (
                            <span className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                              (edited)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing Indicator */}
              {typingUser && (
                <div className="flex justify-start">
                  <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-sm">
                    <p className="text-sm text-gray-500 italic">{typingUser} is typing...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No Contact Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                Select a conversation
              </h2>
              <p className="text-gray-500">Choose a contact to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;

