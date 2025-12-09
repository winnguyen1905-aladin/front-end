import React from 'react';
import { MediaControlButton, UserAvatar } from '../components';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '../icons';

interface VideoPreviewPanelProps {
  userId: string;
  isJoining: boolean;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onMicToggle: () => void;
  onVideoToggle: () => void;
}

export const VideoPreviewPanel: React.FC<VideoPreviewPanelProps> = ({
  userId,
  isJoining,
  isMicEnabled,
  isVideoEnabled,
  previewVideoRef,
  onMicToggle,
  onVideoToggle,
}) => {
  return (
    <div className="relative bg-[#3c4043] rounded-3xl overflow-hidden aspect-video shadow-2xl">
      {/* Video Preview or Avatar */}
      {isVideoEnabled ? (
        <video
          ref={previewVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
          <UserAvatar name={userId} size="xl" showName />
        </div>
      )}

      {/* User Name Overlay */}
      <div className="absolute bottom-6 left-6 bg-black bg-opacity-60 px-4 py-2 rounded-lg">
        <p className="text-white text-sm font-medium">{userId || 'You'}</p>
      </div>

      {/* Media Controls Overlay */}
      <div className="absolute bottom-6 right-6 flex gap-3">
        <MediaControlButton
          onClick={onMicToggle}
          disabled={isJoining}
          isActive={isMicEnabled}
          activeIcon={<MicIcon className="w-5 h-5" />}
          inactiveIcon={<MicOffIcon className="w-5 h-5" />}
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          size="md"
        />

        <MediaControlButton
          onClick={onVideoToggle}
          disabled={isJoining}
          isActive={isVideoEnabled}
          activeIcon={<VideoIcon className="w-5 h-5" />}
          inactiveIcon={<VideoOffIcon className="w-5 h-5" />}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          size="md"
        />
      </div>
    </div>
  );
};

export default VideoPreviewPanel;
