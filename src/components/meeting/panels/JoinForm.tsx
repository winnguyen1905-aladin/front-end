import React, { useEffect } from 'react';
import { StatusIndicator } from '../components';
import { SpinnerIcon } from '../icons';

interface JoinFormProps {
  roomId: string;
  userName: string;
  isJoining: boolean;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  onRoomNameChange: (name: string) => void;
  onUserNameChange: (name: string) => void;
  onJoinRoom: () => void;
}

export const JoinForm: React.FC<JoinFormProps> = ({
  roomId,
  userName,
  isJoining,
  isMicEnabled,
  isVideoEnabled,
  onRoomNameChange,
  onUserNameChange,
  onJoinRoom,
}) => {
  // Load username from localStorage on component mount
  useEffect(() => {
    const savedUserName = localStorage.getItem('meetingUserName');
    if (savedUserName && !userName) {
      onUserNameChange(savedUserName);
    }
  }, []);

  // Save username to localStorage when it changes
  const handleUserNameChange = (name: string) => {
    onUserNameChange(name);
    if (name.trim()) {
      localStorage.setItem('meetingUserName', name.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Room Name Input with Join Button */}
      <div className="flex gap-3">
        <input
          type="text"
          value={roomId}
          onChange={(e) => onRoomNameChange(e.target.value)}
          disabled={isJoining}
          placeholder="Enter room code"
          className="flex-1 px-4 py-3 bg-[#3c4043] border border-[#5f6368] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={onJoinRoom}
          disabled={isJoining || !userName.trim() || !roomId.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none whitespace-nowrap"
        >
          {isJoining ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="h-4 w-4" />
              Joining...
            </span>
          ) : (
            'Join Room'
          )}
        </button>
      </div>

      {/* User Name Input */}
      <input
        type="text"
        value={userName}
        onChange={(e) => handleUserNameChange(e.target.value)}
        disabled={isJoining}
        placeholder="Enter your name"
        className="w-full px-4 py-3 bg-[#3c4043] border border-[#5f6368] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Media Status Indicators */}
      <div className="bg-[#3c4043] rounded-lg p-4 space-y-3">
        <StatusIndicator isActive={isVideoEnabled} label="Camera" />
        <StatusIndicator isActive={isMicEnabled} label="Microphone" />
      </div>

      {/* Back Link */}
      <div className="text-center">
        <a 
          href="/" 
          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          ← Return to home
        </a>
      </div>
    </div>
  );
};

export default JoinForm;
