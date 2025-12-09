import React from 'react';
import { StatusIndicator } from '../components';
import { SpinnerIcon } from '../icons';

interface JoinFormProps {
  roomId: string;
  userId: string;
  isJoining: boolean;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  onRoomNameChange: (name: string) => void;
  onUserNameChange: (name: string) => void;
  onJoinRoom: () => void;
}

export const JoinForm: React.FC<JoinFormProps> = ({
  roomId,
  userId,
  isJoining,
  isMicEnabled,
  isVideoEnabled,
  onRoomNameChange,
  onUserNameChange,
  onJoinRoom,
}) => {
  return (
    <div className="space-y-6">
      {/* Room Name Input */}
      <FormInput
        label="Meeting room"
        value={roomId}
        onChange={onRoomNameChange}
        disabled={isJoining}
        placeholder="Enter room code"
      />

      {/* User Name Input */}
      <FormInput
        label="Your name"
        value={userId}
        onChange={onUserNameChange}
        disabled={isJoining}
        placeholder="Enter your name"
      />

      {/* Media Status Indicators */}
      <div className="bg-[#3c4043] rounded-lg p-4 space-y-3">
        <StatusIndicator isActive={isMicEnabled} label="Microphone" />
        <StatusIndicator isActive={isVideoEnabled} label="Camera" />
      </div>

      {/* Join Button */}
      <button
        onClick={onJoinRoom}
        disabled={isJoining || !userId.trim() || !roomId.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none"
      >
        {isJoining ? (
          <span className="flex items-center justify-center gap-3">
            <SpinnerIcon className="h-5 w-5" />
            Joining...
          </span>
        ) : (
          'Join now'
        )}
      </button>

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

// Sub-component for form inputs
interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-2">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-[#3c4043] border border-[#5f6368] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

export default JoinForm;
