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
  const [isRemoteMediaReady, setIsRemoteMediaReady] = useState(false);
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
  const updateActiveSpeakersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Perform the actual active speakers update with smooth transitions
  const performActiveSpeakersUpdate = useCallback((newListOfActives: string[]) => {
    requestAnimationFrame(() => {
      const startTime = performance.now();
      const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
      const consumers = videoCallSocket.getConsumers();
      const producerState = videoCallSocket.getProducerState();

      // Track current assignments to avoid unnecessary DOM updates
      const currentAssignments = new Map<number, string>();
      Array.from(remoteEls).forEach((el: HTMLVideoElement, index: number) => {
        if (el.srcObject) {
          for (const [aid, consumer] of Object.entries(consumers)) {
            if (consumer.combinedStream === el.srcObject) {
              currentAssignments.set(index, aid);
              break;
            }
          }
        }
      });

      let slot = 0;
      const newAssignments = new Map<number, string>();

      // If there's a pinned video, always put it in slot 0 (main screen)
      if (pinnedProducerId && consumers[pinnedProducerId]) {
        newAssignments.set(0, pinnedProducerId);
        slot = 1;
      }

      newListOfActives.forEach((aid: string) => {
        // Skip own producer
        if (producerState.audioProducer?.id === aid) return;
        // Skip if this is the pinned video (already in slot 0)
        if (pinnedProducerId && aid === pinnedProducerId) return;

        const consumer = consumers[aid];
        if (consumer?.combinedStream) {
          newAssignments.set(slot, aid);
          slot++;
        }
      });

      let changedSlots = 0;

      // Smooth DOM updates with fade effect
      Array.from(remoteEls).forEach((_, index: number) => {
        const currentAid = currentAssignments.get(index);
        const newAid = newAssignments.get(index);

        if (currentAid !== newAid) {
          changedSlots++;

          const remoteVideo = document.getElementById(`remote-video-${index}`) as HTMLVideoElement;
          const remoteVideoUserName = document.getElementById(`userId-${index}`);

          if (newAid && consumers[newAid]) {
            const consumer = consumers[newAid];

            if (remoteVideo && consumer.combinedStream) {
              // Already playing the correct stream
              if (remoteVideo.srcObject === consumer.combinedStream) {
                if (remoteVideo.paused) {
                  remoteVideo.play().catch(err => {
                    console.warn(`[ActiveSpeakers] Resume play blocked for ${consumer.userId}:`, err.message);
                  });
                }
                return;
              }

              // Smooth transition: fade out -> change source -> fade in
              remoteVideo.style.opacity = '0.7';

              setTimeout(() => {
                remoteVideo.playsInline = true;
                remoteVideo.muted = false;
                remoteVideo.autoplay = true;
                remoteVideo.srcObject = consumer.combinedStream;
                remoteVideo.style.opacity = '1';
                remoteVideo.style.transition = 'opacity 0.3s ease';

                // Wait for video to be ready before playing
                const tryPlayVideo = (): void => {
                  if (remoteVideo.readyState >= 2) {
                    remoteVideo.play().catch(err => {
                      console.warn(`[ActiveSpeakers] Auto-play blocked for ${consumer.userId}:`, err.message);
                    });
                  } else {
                    const onReady = (): void => {
                      remoteVideo.play().catch(err => {
                        console.warn(`[ActiveSpeakers] Auto-play blocked for ${consumer.userId}:`, err.message);
                      });
                      remoteVideo.removeEventListener('loadeddata', onReady);
                      remoteVideo.removeEventListener('canplay', onReady);
                    };

                    remoteVideo.addEventListener('loadeddata', onReady, { once: true });
                    remoteVideo.addEventListener('canplay', onReady, { once: true });

                    // Fallback timeout
                    setTimeout(() => {
                      remoteVideo.removeEventListener('loadeddata', onReady);
                      remoteVideo.removeEventListener('canplay', onReady);
                    }, 2000);
                  }
                };

                tryPlayVideo();

                if (changedSlots <= 2) {
                  console.log(`[ActiveSpeakers] Assigned ${consumer.userId} to slot ${index}`);
                }
              }, 50);
            }

            if (remoteVideoUserName) {
              remoteVideoUserName.innerHTML = consumer.userId || '';
            }
          } else {
            // Clear the slot with fade effect
            if (remoteVideo) {
              remoteVideo.style.opacity = '0.5';
              setTimeout(() => {
                remoteVideo.srcObject = null;
                remoteVideo.style.opacity = '1';
              }, 100);
            }
            if (remoteVideoUserName) {
              remoteVideoUserName.innerHTML = '';
            }
          }
        }
      });

      const processingTime = performance.now() - startTime;
      if (changedSlots > 0) {
        console.log(`[ActiveSpeakers] Updated ${changedSlots}/${remoteEls.length} slots in ${processingTime.toFixed(2)}ms`);
      } else if (processingTime > 10) {
        console.warn(`[ActiveSpeakers] Processing took ${processingTime.toFixed(2)}ms (no changes)`);
      }
    });
  }, [pinnedProducerId]);

  // Debounced active speakers update handler
  const onActiveSpeakersUpdate = useCallback((newListOfActives: string[]) => {
    // Debounce rapid updates to prevent video load interruptions
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
    }

    updateActiveSpeakersTimeoutRef.current = setTimeout(() => {
      updateActiveSpeakersTimeoutRef.current = null;
      performActiveSpeakersUpdate(newListOfActives);
    }, 100); // 100ms debounce
  }, [performActiveSpeakersUpdate]);

  // Handle consume complete callback
  const onConsumeComplete = useCallback(() => {
    console.log('[VideoConference] Remote media setup complete, ready to broadcast');
    setIsRemoteMediaReady(true);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    videoCallSocket.connect(import.meta.env.VITE_API_URL, {
      onConnect: () => console.log('[VideoConference] Connected'),
      onDisconnect: (reason) => console.warn('[VideoConference] Disconnected:', reason),
      onActiveSpeakersUpdate: onActiveSpeakersUpdate,
      onConsumeComplete: onConsumeComplete,
    });

    return () => {
      // Clear any pending debounced updates
      if (updateActiveSpeakersTimeoutRef.current) {
        clearTimeout(updateActiveSpeakersTimeoutRef.current);
        updateActiveSpeakersTimeoutRef.current = null;
      }
      videoCallSocket.destroy();
    };
  }, [onActiveSpeakersUpdate, onConsumeComplete]);

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

  const joinRoom = async (userId: string, roomId: string) => {
    if (isJoining || isJoined || !userId.trim() || !roomId.trim()) return;

    setIsJoining(true);
    setIsRemoteMediaReady(false); // Reset remote media ready state
    try {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;

      const response = await videoCallSocket.joinRoom(userId, roomId);
      await videoCallSocket.initDevice(response.routerRtpCapabilities);
      setIsJoined(true);
      
      // Poll until consume is complete, then allow broadcast
      const checkInterval = setInterval(() => {
        if (!videoCallSocket.isConsuming()) {
          clearInterval(checkInterval);
          setIsRemoteMediaReady(true);
        }
      }, 200);
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
    // Clear any pending debounced updates
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
      updateActiveSpeakersTimeoutRef.current = null;
    }

    if (isScreenSharing) await toggleScreenShare();
    await videoCallSocket.endCall();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
    Array.from(remoteEls).forEach(el => { el.srcObject = null; });
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    videoCallSocket.leaveRoom();

    setIsJoined(false);
    setIsRemoteMediaReady(false);
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
        const newPinnedId = pinnedProducerId === aid ? null : aid;
        setPinnedProducerId(newPinnedId);
        console.log('[Pin]', newPinnedId ? `Pinned video: ${aid}` : 'Unpinned video');
        // Force update active speakers to reflect pin change
        performActiveSpeakersUpdate(Object.keys(consumers));
        break;
      }
    }
  };

  return {
    // State
    isJoining,
    isJoined,
    isRemoteMediaReady,
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
  const [userId, setUserName] = useState('user');
  const [roomId, setRoomName] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const {
    isJoining,
    isJoined,
    isRemoteMediaReady,
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
        roomId={roomId}
        userId={userId}
        isJoining={isJoining}
        isMicEnabled={isMicEnabled}
        isVideoEnabled={isVideoEnabled}
        previewVideoRef={previewVideoRef}
        onRoomNameChange={setRoomName}
        onUserNameChange={setUserName}
        onMicToggle={() => setIsMicEnabled(!isMicEnabled)}
        onVideoToggle={() => setIsVideoEnabled(!isVideoEnabled)}
        onJoinRoom={() => joinRoom(userId, roomId)}
      />
    );
  }

  return (
    <ActiveCall
      localVideoRef={localVideoRef}
      isRemoteMediaReady={isRemoteMediaReady}
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
