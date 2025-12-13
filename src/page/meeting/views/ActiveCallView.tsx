import React, { useState, useEffect, useCallback } from 'react';
import {
  TopBar,
  ControlBar,
  VideoGrid,
  LocalVideoPreview,
  ParticipantsList,
} from '@components/meeting';
import type { ConsumerInfo } from '@components/meeting/panels/VideoGrid';
import type { RoomInfo } from '@context/StreamContext';

export interface ActiveCallViewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteMediaReady: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSegmentationEnabled?: boolean;
  consumers: ConsumerInfo[];
  isNewRoom: boolean;
  roomInfo: RoomInfo | null;
  currentUserId?: string;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
  onRefreshStreams: () => void;
  onToggleSegmentation?: () => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  localVideoRef,
  isRemoteMediaReady,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isSegmentationEnabled = false,
  consumers,
  isNewRoom,
  roomInfo,
  currentUserId,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
  onRefreshStreams,
  onToggleSegmentation,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  const handlePinVideo = useCallback((index: number) => {
    setPinnedIndex(index);
    // Refresh streams after layout change with small delay for DOM update
    setTimeout(() => onRefreshStreams(), 50);
  }, [onRefreshStreams]);

  const handleUnpinVideo = useCallback(() => {
    setPinnedIndex(null);
    // Refresh streams after layout change with small delay for DOM update
    setTimeout(() => onRefreshStreams(), 50);
  }, [onRefreshStreams]);

  // Determine loading state: not a new room and not ready yet
  const isLoading = !isNewRoom && !isRemoteMediaReady;

  return (
    <div
      className="min-h-screen bg-[#202124] relative overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Top Bar */}
      <TopBar 
        isVisible={showControls} 
        roomInfo={roomInfo}
        onShowParticipants={() => setShowParticipants(true)}
      />

      {/* Participants Panel */}
      <ParticipantsList
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        roomInfo={roomInfo}
        currentUserId={currentUserId}
      />

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
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        isSegmentationEnabled={isSegmentationEnabled}
        onMuteAudio={onMuteAudio}
        onVideoToggle={onVideoToggle}
        onScreenShare={onScreenShare}
        onHangUp={onHangUp}
        onToggleSegmentation={onToggleSegmentation}
      />
    </div>
  );
};

export default ActiveCallView;
