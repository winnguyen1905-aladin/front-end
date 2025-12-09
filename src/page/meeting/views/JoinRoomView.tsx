import React from 'react';
import {
  JoinForm,
  VideoPreviewPanel,
} from '@components/meeting';

export interface JoinRoomViewProps {
  roomId: string;
  userId: string;
  isJoining: boolean;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onRoomNameChange: (name: string) => void;
  onUserNameChange: (name: string) => void;
  onMicToggle: () => void;
  onVideoToggle: () => void;
  onJoinRoom: () => void;
}

export const JoinRoomView: React.FC<JoinRoomViewProps> = ({
  roomId,
  userId,
  isJoining,
  isMicEnabled,
  isVideoEnabled,
  previewVideoRef,
  onRoomNameChange,
  onUserNameChange,
  onMicToggle,
  onVideoToggle,
  onJoinRoom,
}) => {
  return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-normal text-white mb-2">
            Ready to join?
          </h1>
          <p className="text-gray-400 text-sm">
            Check your audio and video before joining the meeting
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Side - Video Preview */}
          <div className="lg:col-span-3">
            <VideoPreviewPanel
              userId={userId}
              isJoining={isJoining}
              isMicEnabled={isMicEnabled}
              isVideoEnabled={isVideoEnabled}
              previewVideoRef={previewVideoRef}
              onMicToggle={onMicToggle}
              onVideoToggle={onVideoToggle}
            />
          </div>

          {/* Right Side - Form */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <JoinForm
              roomId={roomId}
              userId={userId}
              isJoining={isJoining}
              isMicEnabled={isMicEnabled}
              isVideoEnabled={isVideoEnabled}
              onRoomNameChange={onRoomNameChange}
              onUserNameChange={onUserNameChange}
              onJoinRoom={onJoinRoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoomView;
