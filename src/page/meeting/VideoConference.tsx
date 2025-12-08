import React, { useEffect, useRef, useState, useCallback } from 'react';
import { videoCallSocket } from '@socket/socketService';
import getMic2 from '@utils/getMic2';
import { JoinRoom } from './JoinRoom';
import { ActiveCall } from './ActiveCall';

// ==============================
// Custom Hook: useVideoCall
// ==============================

function useVideoCall() {
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isStreamEnabled, setIsStreamEnabled] = useState(false);
  const [isStreamSent, setIsStreamSent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [pinnedProducerId, setPinnedProducerId] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Update remote video elements when active speakers change
  const updateRemoteVideos = useCallback((speakers: string[]) => {
    requestAnimationFrame(() => {
      const consumers = videoCallSocket.getConsumers();
      const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
      const producerState = videoCallSocket.getProducerState();

      let slot = pinnedProducerId && consumers[pinnedProducerId] ? 1 : 0;

      // Handle pinned video first
      if (pinnedProducerId && consumers[pinnedProducerId]) {
        const el = remoteEls[0];
        const consumer = consumers[pinnedProducerId];
        if (el && consumer.combinedStream && el.srcObject !== consumer.combinedStream) {
          el.srcObject = consumer.combinedStream;
          el.play().catch(() => {});
        }
        const nameEl = document.getElementById('username-0');
        if (nameEl) nameEl.innerHTML = consumer.userName || '';
      }

      speakers.forEach((aid) => {
        // Skip own producer and pinned video
        if (producerState.audioProducer?.id === aid) return;
        if (pinnedProducerId === aid) return;
        if (slot >= remoteEls.length) return;

        const consumer = consumers[aid];
        if (consumer?.combinedStream) {
          const el = remoteEls[slot];
          if (el && el.srcObject !== consumer.combinedStream) {
            el.srcObject = consumer.combinedStream;
            el.play().catch(() => {});
          }
          const nameEl = document.getElementById(`username-${slot}`);
          if (nameEl) nameEl.innerHTML = consumer.userName || '';
          slot++;
        }
      });
    });
  }, [pinnedProducerId]);

  // Initialize socket connection
  useEffect(() => {
    videoCallSocket.connect(import.meta.env.VITE_API_URL, {
      onConnect: () => console.log('[VideoConference] Connected'),
      onDisconnect: (reason) => console.warn('[VideoConference] Disconnected:', reason),
      onActiveSpeakersUpdate: updateRemoteVideos,
    });

    return () => {
      videoCallSocket.destroy();
    };
  }, [updateRemoteVideos]);

  // Preview video
  useEffect(() => {
    if (!isJoined && isVideoEnabled) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          previewStreamRef.current = stream;
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {});
    }

    return () => {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
    };
  }, [isVideoEnabled, isJoined]);

  const joinRoom = async (userName: string, roomName: string) => {
    if (isJoining || isJoined || !userName.trim() || !roomName.trim()) return;

    setIsJoining(true);
    try {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;

      const response = await videoCallSocket.joinRoom(userName, roomName);
      await videoCallSocket.initDevice(response.routerRtpCapabilities);
      setIsJoined(true);
    } catch (err) {
      console.error('[VideoConference] Join failed:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const enableFeed = async (isMicEnabled: boolean, isVideoEnabled: boolean) => {
    if (localStreamRef.current) return;

    try {
      const mic2Id = await getMic2();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: mic2Id ? { deviceId: { exact: mic2Id } } : true,
      });

      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) videoTrack.enabled = isVideoEnabled;
      if (audioTrack) audioTrack.enabled = isMicEnabled;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsStreamEnabled(true);
      if (!isMicEnabled) setIsMuted(true);
    } catch (err) {
      console.error('[VideoConference] Enable feed failed:', err);
    }
  };

  const sendFeed = async () => {
    if (!isJoined || !videoCallSocket.isDeviceReady() || !localStreamRef.current) return;

    try {
      await videoCallSocket.startProducing(localStreamRef.current);
      setIsStreamSent(true);
    } catch (err) {
      console.error('[VideoConference] Send feed failed:', err);
    }
  };

  const muteAudio = async () => {
    const state = videoCallSocket.getProducerState();
    if (!state.audioProducer) return;

    const shouldMute = !state.audioProducer.paused;
    await videoCallSocket.toggleAudio(shouldMute);
    videoCallSocket.sendAudioChange(shouldMute ? 'mute' : 'unmute');
    setIsMuted(shouldMute);
  };

  const toggleVideo = async () => {
    const state = videoCallSocket.getProducerState();
    if (!state.videoProducer) return;

    const shouldDisable = !state.videoProducer.paused;
    
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) track.enabled = !shouldDisable;
    }

    await videoCallSocket.toggleVideo(shouldDisable);
    setIsVideoEnabled(!shouldDisable);
  };

  const toggleScreenShare = async () => {
    if (!isStreamSent) return;

    if (isScreenSharing) {
      await videoCallSocket.stopScreenShare();
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: true,
        });
        screenStreamRef.current = stream;

        stream.getVideoTracks()[0].onended = () => toggleScreenShare();
        await videoCallSocket.startScreenShare(stream);
        setIsScreenSharing(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.error('[VideoConference] Screen share failed:', err);
        }
      }
    }
  };

  const hangUp = async () => {
    if (isScreenSharing) await toggleScreenShare();
    await videoCallSocket.endCall();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
    Array.from(remoteEls).forEach(el => { el.srcObject = null; });
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    videoCallSocket.leaveRoom();

    setIsJoined(false);
    setIsStreamEnabled(false);
    setIsStreamSent(false);
    setIsMuted(false);
    setIsScreenSharing(false);
    setPinnedProducerId(null);
  };

  const pinVideo = (index: number) => {
    const el = document.getElementById(`remote-video-${index}`) as HTMLVideoElement;
    if (!el?.srcObject) return;

    const consumers = videoCallSocket.getConsumers();
    for (const [aid, consumer] of Object.entries(consumers)) {
      if (consumer.combinedStream === el.srcObject) {
        setPinnedProducerId(prev => prev === aid ? null : aid);
        updateRemoteVideos(Object.keys(consumers));
        break;
      }
    }
  };

  return {
    // State
    isJoining,
    isJoined,
    isStreamEnabled,
    isStreamSent,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    pinnedProducerId,
    // Refs
    localVideoRef,
    previewVideoRef,
    // Actions
    joinRoom,
    enableFeed,
    sendFeed,
    muteAudio,
    toggleVideo,
    toggleScreenShare,
    hangUp,
    pinVideo,
    setIsVideoEnabled,
    setIsMuted,
  };
}

// ==============================
// VideoConference Component (UI Only)
// ==============================

export const VideoConference: React.FC = () => {
  const [userName, setUserName] = useState('user');
  const [roomName, setRoomName] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const {
    isJoining,
    isJoined,
    isStreamEnabled,
    isStreamSent,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    pinnedProducerId,
    localVideoRef,
    previewVideoRef,
    joinRoom,
    enableFeed,
    sendFeed,
    muteAudio,
    toggleVideo,
    toggleScreenShare,
    hangUp,
    pinVideo,
    setIsVideoEnabled,
  } = useVideoCall();

  if (!isJoined) {
    return (
      <JoinRoom
        roomName={roomName}
        userName={userName}
        isJoining={isJoining}
        isMicEnabled={isMicEnabled}
        isVideoEnabled={isVideoEnabled}
        previewVideoRef={previewVideoRef}
        onRoomNameChange={setRoomName}
        onUserNameChange={setUserName}
        onMicToggle={() => setIsMicEnabled(!isMicEnabled)}
        onVideoToggle={() => setIsVideoEnabled(!isVideoEnabled)}
        onJoinRoom={() => joinRoom(userName, roomName)}
      />
    );
  }

  return (
    <ActiveCall
      localVideoRef={localVideoRef}
      isStreamEnabled={isStreamEnabled}
      isStreamSent={isStreamSent}
      isMuted={isMuted}
      isVideoEnabled={isVideoEnabled}
      isScreenSharing={isScreenSharing}
      pinnedProducerId={pinnedProducerId}
      onEnableFeed={() => enableFeed(isMicEnabled, isVideoEnabled)}
      onSendFeed={sendFeed}
      onMuteAudio={muteAudio}
      onVideoToggle={toggleVideo}
      onScreenShare={toggleScreenShare}
      onHangUp={hangUp}
      onPinVideo={pinVideo}
    />
  );
};

export default VideoConference;
