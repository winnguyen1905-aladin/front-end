import React, { useState } from 'react';
import {
  TopBar,
  ControlBar,
  VideoGrid,
  LocalVideoPreview,
} from '@components/meeting';
import type { ConsumerInfo } from '@components/meeting/panels/VideoGrid';

export interface ActiveCallViewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteMediaReady: boolean;
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  consumers: ConsumerInfo[];
  isNewRoom: boolean;
  onEnableFeed: () => void;
  onSendFeed: () => void;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  localVideoRef,
  isRemoteMediaReady,
  isStreamEnabled,
  isStreamSent,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  consumers,
  isNewRoom,
  onEnableFeed,
  onSendFeed,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const handlePinVideo = (index: number) => {
    setPinnedIndex(index);
  };

  const handleUnpinVideo = () => {
    setPinnedIndex(null);
  };

  // Determine loading state: not a new room and not ready yet
  const isLoading = !isNewRoom && !isRemoteMediaReady;

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
          consumers={consumers}
          pinnedIndex={pinnedIndex}
          onPinVideo={handlePinVideo}
          onUnpinVideo={handleUnpinVideo}
          isLoading={isLoading}
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
