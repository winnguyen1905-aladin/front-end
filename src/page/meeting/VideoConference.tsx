import React from 'react';
import { useVideoCall } from '@hooks/useStream';
import { JoinRoomView, ActiveCallView } from './views';

// ==============================
// VideoConference Page (Parent)
// ==============================
// This is the main meeting page that orchestrates the meeting flow.
// It renders either JoinRoomView or ActiveCallView based on state.

export const VideoConferencePage: React.FC = () => {
  const {
    // Local UI state
    userId,
    setUserId,
    roomId,
    setRoomId,
    isMicEnabled,
    setIsMicEnabled,
    
    // Stream context state
    isJoining,
    isJoined,
    isRemoteMediaReady,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    isSegmentationEnabled,
    isNewRoom,
    consumers,
    roomInfo,
    
    // Refs
    localVideoRef,
    previewVideoRef,
    
    // Actions
    handleJoinRoom,
    muteAudio,
    toggleVideo,
    toggleScreenShare,
    toggleSegmentation,
    hangUp,
    setIsVideoEnabled,
    refreshVideoStreams,
  } = useVideoCall();

  // View: Join Room (pre-call lobby)
  if (!isJoined) {
    return (
      <JoinRoomView
        roomId={roomId}
        userName={userId}
        isJoining={isJoining}
        isMicEnabled={isMicEnabled}
        isVideoEnabled={isVideoEnabled}
        previewVideoRef={previewVideoRef}
        onRoomNameChange={setRoomId}
        onUserNameChange={setUserId}
        onMicToggle={() => setIsMicEnabled(!isMicEnabled)}
        onVideoToggle={() => setIsVideoEnabled(!isVideoEnabled)}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  // View: Active Call (in-call)
  return (
    <ActiveCallView
      localVideoRef={localVideoRef}
      isRemoteMediaReady={isRemoteMediaReady}
      isMuted={isMuted}
      isVideoEnabled={isVideoEnabled}
      isScreenSharing={isScreenSharing}
      isSegmentationEnabled={isSegmentationEnabled}
      consumers={consumers}
      isNewRoom={isNewRoom}
      roomInfo={roomInfo}
      currentUserId={userId}
      onMuteAudio={muteAudio}
      onVideoToggle={toggleVideo}
      onScreenShare={toggleScreenShare}
      onHangUp={hangUp}
      onRefreshStreams={refreshVideoStreams}
      onToggleSegmentation={toggleSegmentation}
    />
  );
};
