import React, { useState } from 'react';
import {
  TopBar,
  ControlBar,
  VideoGrid,
  LocalVideoPreview,
} from '@components/meeting';

export interface ActiveCallViewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteMediaReady: boolean;
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  pinnedProducerId: string | null;
  onEnableFeed: () => void;
  onSendFeed: () => void;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
  onPinVideo: (videoIndex: number) => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  localVideoRef,
  isRemoteMediaReady,
  isStreamEnabled,
  isStreamSent,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  pinnedProducerId,
  onEnableFeed,
  onSendFeed,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
  onPinVideo,
}) => {
  const [showControls, setShowControls] = useState(true);

  return (
    <div
      className="min-h-screen bg-[#202124] relative overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Top Bar */}
      <TopBar isVisible={showControls} />

      {/* Video Grid Container */}
      <div className="h-screen flex items-center justify-center p-4 pt-20 pb-32">
        <VideoGrid
          pinnedProducerId={pinnedProducerId}
          onPinVideo={onPinVideo}
        />
      </div>

      {/* Local Video PiP */}
      <LocalVideoPreview
        videoRef={localVideoRef}
        isVideoEnabled={isVideoEnabled}
      />

      {/* Control Bar */}
      <ControlBar
        isVisible={showControls}
        isStreamEnabled={isStreamEnabled}
        isStreamSent={isStreamSent}
        isRemoteMediaReady={isRemoteMediaReady}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        onEnableFeed={onEnableFeed}
        onSendFeed={onSendFeed}
        onMuteAudio={onMuteAudio}
        onVideoToggle={onVideoToggle}
        onScreenShare={onScreenShare}
        onHangUp={onHangUp}
      />
    </div>
  );
};

export default ActiveCallView;
