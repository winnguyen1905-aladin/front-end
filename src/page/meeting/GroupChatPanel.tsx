import React, { useState, useEffect, useRef } from 'react';
import { SocketManager, ChatEventHandlers } from '@socket/socket-manager';
import type { GroupMessage, NewGroupMessageData } from '@socket/socket-manager';

interface GroupChatPanelProps {
  roomId: string;
  userName: string;
  socketManager?: SocketManager;
  isOpen?: boolean;
  onClose?: () => void;
}

export const GroupChatPanel: React.FC<GroupChatPanelProps> = ({
  roomId,
  userName,
  socketManager,
  isOpen = true,
  onClose,
}) => {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketManagerRef = useRef<SocketManager | null>(socketManager || null);

  // Initialize chat handlers
  useEffect(() => {
    if (!socketManagerRef.current) return;

    const chatHandlers: ChatEventHandlers = {
      onNewGroupMessage: (data: NewGroupMessageData) => {
        if (data.roomId === roomId) {
          console.log('New group message:', data.message);
          setMessages((prev) => [...prev, data.message]);
        }
      },

      onGroupTypingIndicator: (data) => {
        if (data.roomId === roomId) {
          if (data.isTyping) {
            setTypingUsers((prev) =>
              prev.includes(data.userName) ? prev : [...prev, data.userName]
            );
          } else {
            setTypingUsers((prev) => prev.filter((name) => name !== data.userName));
          }
        }
      },

      onGroupMessageReaction: (data) => {
        if (data.roomId === roomId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg
            )
          );
        }
      },

      onGroupMessagePinned: (data) => {
        if (data.roomId === roomId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.messageId ? { ...msg, isPinned: data.isPinned } : msg
            )
          );
        }
      },

      onGroupMessageDeleted: (data) => {
        if (data.roomId === roomId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
        }
      },

      onGroupMessageEdited: (data) => {
        if (data.roomId === roomId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.messageId
                ? { ...msg, content: data.newContent, isEdited: true, editedAt: data.editedAt }
                : msg
            )
          );
        }
      },
    };

    socketManagerRef.current.updateChatHandlers(chatHandlers);

    // Load chat history
    loadChatHistory();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    if (!socketManagerRef.current) return;

    try {
      const response = await socketManagerRef.current.client.emitWithAck('chat:getGroupHistory', {
        roomId,
        limit: 100,
        offset: 0,
      });

      if (response) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Failed to load group chat history:', error);
      // Show empty chat for demo
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
      const response = await socketManagerRef.current.client.emitWithAck('chat:sendGroupMessage', {
        roomId,
        content: messageContent,
        messageType: 'text',
        timestamp: Date.now(),
      });

      if (response.success) {
        // Message will be added via socket event
        console.log('Message sent successfully');
      }
    } catch (error) {
      console.error('Failed to send group message:', error);
    }
  };

  const handleTyping = () => {
    if (!socketManagerRef.current) return;

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketManagerRef.current.client.emit('chat:groupTyping', {
        roomId,
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
    socketManagerRef.current.client.emit('chat:groupTyping', {
      roomId,
      isTyping: false,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!socketManagerRef.current) return;

    try {
      await socketManagerRef.current.client.emitWithAck('chat:groupReaction', {
        roomId,
        messageId,
        emoji,
        action: 'add',
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
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

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Group Chat</h3>
          <p className="text-xs text-blue-100">{roomId}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
            aria-label="Close chat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderName === userName;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[80%]">
                  {/* Sender Name (for others' messages) */}
                  {!isMine && (
                    <p className="text-xs text-gray-500 mb-1 ml-2">{message.senderName}</p>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`px-3 py-2 rounded-lg ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-gray-900 rounded-bl-none shadow-sm border border-gray-200'
                    }`}
                  >
                    {message.isPinned && (
                      <div className="flex items-center text-xs mb-1 opacity-75">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1z" />
                        </svg>
                        Pinned
                      </div>
                    )}

                    <p className="text-sm break-words">{message.content}</p>

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.reactions.map((reaction, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              isMine ? 'bg-blue-700' : 'bg-gray-100'
                            }`}
                          >
                            {reaction.emoji} {reaction.count}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Message Info */}
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <span
                        className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}
                      >
                        {formatTime(message.timestamp)}
                      </span>
                      {message.isEdited && (
                        <span
                          className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}
                        >
                          (edited)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Reactions */}
                  {!isMine && (
                    <div className="flex space-x-1 mt-1 ml-2">
                      {['👍', '❤️', '😂', '🎉'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(message.id, emoji)}
                          className="text-xs hover:scale-125 transition-transform"
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white px-3 py-2 rounded-lg rounded-bl-none shadow-sm border border-gray-200">
              <p className="text-xs text-gray-500 italic">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing...`
                  : `${typingUsers.length} people are typing...`}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-3 bg-white border-t border-gray-200">
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
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatPanel;

