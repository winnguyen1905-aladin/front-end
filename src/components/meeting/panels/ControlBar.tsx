import React from 'react';
import { MediaControlButton } from '../components';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  HangUpIcon,
  ClockIcon,
  MoreIcon,
} from '../icons';

interface ControlBarProps {
  isVisible: boolean;
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isRemoteMediaReady: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onEnableFeed: () => void;
  onSendFeed: () => void;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isVisible,
  isStreamEnabled,
  isStreamSent,
  isRemoteMediaReady,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  onEnableFeed,
  onSendFeed,
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
      <div className="bg-[#202124] border-t border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Initial Setup Buttons */}
          {(!isStreamEnabled || !isStreamSent) && (
            <SetupButtons
              isStreamEnabled={isStreamEnabled}
              isStreamSent={isStreamSent}
              isRemoteMediaReady={isRemoteMediaReady}
              onEnableFeed={onEnableFeed}
              onSendFeed={onSendFeed}
            />
          )}

          {/* Main Controls */}
          <div className="flex items-center justify-between">
            {/* Left - Meeting Info */}
            <div className="flex-1 flex items-center gap-2">
              <div className="text-gray-400 text-sm hidden md:block">
                <ClockIcon />
              </div>
            </div>

            {/* Center - Primary Controls */}
            <div className="flex items-center gap-3">
              <MediaControlButton
                onClick={onMuteAudio}
                disabled={!isStreamSent}
                isActive={!isMuted}
                activeIcon={<MicIcon />}
                inactiveIcon={<MicOffIcon />}
                title={isMuted ? 'Unmute' : 'Mute'}
              />

              <MediaControlButton
                onClick={onVideoToggle}
                disabled={!isStreamSent}
                isActive={isVideoEnabled}
                activeIcon={<VideoIcon />}
                inactiveIcon={<VideoOffIcon />}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              />

              <MediaControlButton
                onClick={onScreenShare}
                disabled={!isStreamSent}
                isActive={!isScreenSharing}
                activeIcon={<ScreenShareIcon />}
                inactiveIcon={<ScreenShareIcon />}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              />

              <MediaControlButton
                onClick={onHangUp}
                disabled={!isStreamSent}
                isActive={false}
                activeIcon={<HangUpIcon />}
                inactiveIcon={<HangUpIcon />}
                title="Leave call"
                variant="danger"
              />
            </div>

            {/* Right - More Options */}
            <div className="flex-1 flex justify-end">
              <button
                className="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4d5053] text-white flex items-center justify-center transition-all"
                title="More options"
              >
                <MoreIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component for setup buttons
interface SetupButtonsProps {
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isRemoteMediaReady: boolean;
  onEnableFeed: () => void;
  onSendFeed: () => void;
}

const SetupButtons: React.FC<SetupButtonsProps> = ({
  isStreamEnabled,
  isStreamSent,
  isRemoteMediaReady,
  onEnableFeed,
  onSendFeed,
}) => (
  <div className="flex justify-center gap-3 mb-4 pb-4 border-b border-gray-700">
    {!isStreamEnabled && (
      <button
        onClick={onEnableFeed}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg"
      >
        Enable Camera & Mic
      </button>
    )}
    {isStreamEnabled && !isStreamSent && (
      <button
        onClick={onSendFeed}
        disabled={!isRemoteMediaReady}
        className={`px-6 py-2 text-white text-sm font-medium rounded-lg transition-all shadow-lg ${
          isRemoteMediaReady
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-500 cursor-not-allowed opacity-60'
        }`}
      >
        {isRemoteMediaReady ? 'Start Broadcasting' : 'Connecting to room...'}
      </button>
    )}
  </div>
);

export default ControlBar;
