import React from 'react';
import { MediaControlButton } from '../components';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  HangUpIcon,
} from '../icons';

interface ControlBarProps {
  isVisible: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isVisible,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
}) => {
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-[#202124]/95 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-3">
            {/* Mic Toggle */}
            <MediaControlButton
              onClick={onMuteAudio}
              isActive={!isMuted}
              activeIcon={<MicIcon />}
              inactiveIcon={<MicOffIcon />}
              title={isMuted ? 'Unmute' : 'Mute'}
            />

            {/* Video Toggle */}
            <MediaControlButton
              onClick={onVideoToggle}
              isActive={isVideoEnabled}
              activeIcon={<VideoIcon />}
              inactiveIcon={<VideoOffIcon />}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            />

            {/* Screen Share */}
            <MediaControlButton
              onClick={onScreenShare}
              isActive={isScreenSharing}
              activeIcon={<ScreenShareIcon />}
              inactiveIcon={<ScreenShareIcon />}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            />

            {/* Hang Up */}
            <MediaControlButton
              onClick={onHangUp}
              isActive={false}
              activeIcon={<HangUpIcon />}
              inactiveIcon={<HangUpIcon />}
              title="Leave call"
              variant="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
