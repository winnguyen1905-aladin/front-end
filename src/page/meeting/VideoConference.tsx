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
    isStreamEnabled,
    isStreamSent,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    isNewRoom,
    consumers,
    
    // Refs
    localVideoRef,
    previewVideoRef,
    
    // Actions
    handleJoinRoom,
    handleEnableFeed,
    sendFeed,
    muteAudio,
    toggleVideo,
    toggleScreenShare,
    hangUp,
    setIsVideoEnabled,
  } = useVideoCall();

  // View: Join Room (pre-call lobby)
  if (!isJoined) {
    return (
      <JoinRoomView
        roomId={roomId}
        userId={userId}
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
      isStreamEnabled={isStreamEnabled}
      isStreamSent={isStreamSent}
      isMuted={isMuted}
      isVideoEnabled={isVideoEnabled}
      isScreenSharing={isScreenSharing}
      consumers={consumers}
      isNewRoom={isNewRoom}
      onEnableFeed={handleEnableFeed}
      onSendFeed={sendFeed}
      onMuteAudio={muteAudio}
      onVideoToggle={toggleVideo}
      onScreenShare={toggleScreenShare}
      onHangUp={hangUp}
    />
  );
};
