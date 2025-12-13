import React from 'react';
import { MediaControlButton } from '../components';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  HangUpIcon,
  BackgroundRemoveIcon,
} from '../icons';
// import { Navigate, useNavigate } from "react-router-dom";

interface ControlBarProps {
  isVisible: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSegmentationEnabled?: boolean;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
  onToggleSegmentation?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isVisible,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isSegmentationEnabled = false,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
  onToggleSegmentation,
}) => {
  // const navigate = useNavigate();
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

            {/* Background Removal */}
            {onToggleSegmentation && (
              <MediaControlButton
                onClick={onToggleSegmentation}
                isActive={isSegmentationEnabled}
                activeIcon={<BackgroundRemoveIcon />}
                inactiveIcon={<BackgroundRemoveIcon />}
                title={isSegmentationEnabled ? 'Disable background removal' : 'Remove background'}
              />
            )}

            {/* Hang Up */}
            <MediaControlButton
              // onClick={onHangUp}
              onClick={() => window.location.href = "/"}
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
