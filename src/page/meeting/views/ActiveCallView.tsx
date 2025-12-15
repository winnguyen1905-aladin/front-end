import React, { useState, useEffect, useCallback } from 'react';
import {
  TopBar,
  ControlBar,
  VideoGrid,
  LocalVideoPreview,
  ParticipantsList,
} from '@components/meeting';
import type { ConsumerInfo } from '@components/meeting/panels/VideoGrid';
import type { RoomInfo, SegmentationMode, FaceEnhancementConfig } from '@context/StreamContext';

export interface ActiveCallViewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteMediaReady: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSegmentationEnabled?: boolean;
  segmentationMode?: SegmentationMode;
  faceEnhancement?: FaceEnhancementConfig;
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
  onSetVirtualBackground?: (bg: string | File) => Promise<void>;
  onSetSegmentationMode?: (mode: SegmentationMode) => void;
  onSetFaceEnhancement?: (config: Partial<FaceEnhancementConfig>) => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  localVideoRef,
  isRemoteMediaReady,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isSegmentationEnabled = false,
  segmentationMode = 'none',
  faceEnhancement,
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
  onSetVirtualBackground,
  onSetSegmentationMode,
  onSetFaceEnhancement,
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
      className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#202124] to-[#2d2d30] relative overflow-hidden animate-gradient"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,rgba(255,255,255,0.02)_49%,rgba(255,255,255,0.02)_51%,transparent_52%)] bg-[length:20px_20px]"></div>
      </div>

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

      {/* Video Grid Container with Enhanced Layout */}
      <div className="h-screen flex items-center justify-center p-4 pt-20 pb-32 animate-fade-in">
        <div className="w-full max-w-7xl animate-scale-in">
          <VideoGrid
            consumers={consumers}
            pinnedIndex={pinnedIndex}
            onPinVideo={handlePinVideo}
            onUnpinVideo={handleUnpinVideo}
            isLoading={isLoading}
          />
        </div>
        
        {/* Loading Overlay with Animation */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-fade-in">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 animate-bounce-in">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-white text-lg">Connecting to meeting...</p>
              </div>
            </div>
          </div>
        )}
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
        segmentationMode={segmentationMode}
        faceEnhancement={faceEnhancement}
        onMuteAudio={onMuteAudio}
        onVideoToggle={onVideoToggle}
        onScreenShare={onScreenShare}
        onHangUp={onHangUp}
        onToggleSegmentation={onToggleSegmentation}
        onSetVirtualBackground={onSetVirtualBackground}
        onSetSegmentationMode={onSetSegmentationMode}
        onSetFaceEnhancement={onSetFaceEnhancement}
      />

      {/* Ambient Light Effects */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '1s'}}></div>
      </div>
    </div>
  );
};

export default ActiveCallView;
