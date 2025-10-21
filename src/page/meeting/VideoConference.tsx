import React, { useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import getMic2 from '@utils/getMic2';
import {
  SocketManager,
  ConnectionEventHandlers,
  RoomEventHandlers,
  JoinRoomResponse,
  ProducerState,
  CallManagerOptions
} from '@socket/socket-manager';
import { JoinRoom } from './JoinRoom';
import { ActiveCall } from './ActiveCall';

export const VideoConference: React.FC = () => {
  // State management
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [userName, setUserName] = useState('user');
  const [roomName, setRoomName] = useState('');
  const [isStreamEnabled, setIsStreamEnabled] = useState(false);
  const [isStreamSent, setIsStreamSent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Media preferences (set before joining)
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Pinned video state (null = no pin, or producerId of pinned video)
  const [pinnedProducerId, setPinnedProducerId] = useState<string | null>(null);

  // Refs for MediaSoup components
  const socketManagerRef = useRef<SocketManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const deviceLoadedRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const updateActiveSpeakersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Initialize socket manager on component mount
  useEffect(() => {
    const connectionHandlers: ConnectionEventHandlers = {
      onConnect: () => console.log('[MediaSoupClient] Socket connected:', socketManagerRef.current?.id),
      onDisconnect: (reason: string) => console.warn('[MediaSoupClient] Socket disconnected:', reason),
      onError: (error) => console.error('[MediaSoupClient] Socket error:', error.message),
    };

    const roomHandlers: RoomEventHandlers = {
      onActiveSpeakersUpdate: (speakers: string[]) => onUpdateActiveSpeakers(speakers),
      onNewProducers: (data) => onNewProducersToConsume(data),
    };

    socketManagerRef.current = new SocketManager(import.meta.env.VITE_API_URL, {
      connectionHandlers,
      roomHandlers,
      namespace: '/', // Use root namespace for video calls
    });

    return () => {
      if (socketManagerRef.current) {
        socketManagerRef.current.destroy();
      }
    };
  }, []);

  // Enable preview video when component mounts
  useEffect(() => {
    const enablePreview = async () => {
      if (!isJoined && isVideoEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false, // Only video for preview
          });
          previewStreamRef.current = stream;
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('[Preview] Failed to get preview video:', err);
        }
      }
    };

    enablePreview();

    return () => {
      // Cleanup preview stream
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
      }
    };
  }, [isVideoEnabled, isJoined]);

  const onUpdateActiveSpeakers = (newListOfActives: string[]) => {
    // Debounce rapid updates to prevent video load interruptions
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
    }

    updateActiveSpeakersTimeoutRef.current = setTimeout(() => {
      updateActiveSpeakersTimeoutRef.current = null;
      performActiveSpeakersUpdate(newListOfActives);
    }, 100); // 100ms debounce
  };

  const performActiveSpeakersUpdate = (newListOfActives: string[]) => {
    // Use requestAnimationFrame for smooth DOM updates
    requestAnimationFrame(() => {
      const startTime = performance.now();
      const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;

      // Track current assignments to avoid unnecessary DOM updates
      const currentAssignments = new Map<number, string>();
      const consumers = socketManagerRef.current?.call?.getConsumers() || {};

      // Store current video assignments
      Array.from(remoteEls).forEach((el: HTMLVideoElement, index: number) => {
        if (el.srcObject) {
          // Find which consumer is currently in this slot
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
        // do not show THIS client in remote slots
        const producerState = socketManagerRef.current?.call?.getProducerState();
        if (producerState?.audioProducer && aid === producerState.audioProducer.id) return;

        // Skip if this is the pinned video (already in slot 0)
        if (pinnedProducerId && aid === pinnedProducerId) return;

        const consumers = socketManagerRef.current?.call?.getConsumers() || {};
        const consumerForThisSlot = consumers[aid];
        if (consumerForThisSlot && consumerForThisSlot.combinedStream) {
          newAssignments.set(slot, aid);
        }
        slot += 1;
      });

      let changedSlots = 0;

      // Smooth DOM updates with fade effect for better UX
      Array.from(remoteEls).forEach((_, index: number) => {
        const currentAid = currentAssignments.get(index);
        const newAid = newAssignments.get(index);

        if (currentAid !== newAid) {
          changedSlots++;

          const remoteVideo = document.getElementById(`remote-video-${index}`) as HTMLVideoElement;
          const remoteVideoUserName = document.getElementById(`username-${index}`);

          if (newAid && consumers[newAid]) {
            const consumer = consumers[newAid];

            if (remoteVideo && consumer.combinedStream) {
              // Check if we're already playing this stream to avoid unnecessary interruption
              if (remoteVideo.srcObject === consumer.combinedStream) {
                // Already playing the correct stream, just ensure it's playing
                if (remoteVideo.paused) {
                  remoteVideo.play().catch(err => {
                    console.warn(`[ActiveSpeakers] Resume play blocked for ${consumer.userName}:`, err.message);
                  });
                }
                return; // Skip the rest of the update for this slot
              }

              // Smooth transition: fade out -> change source -> fade in
              remoteVideo.style.opacity = '0.7';

              // Use setTimeout to avoid blocking main thread during video stream switch
              setTimeout(() => {
                // Optimize video element for smooth playback
                remoteVideo.playsInline = true;
                remoteVideo.muted = false; // Allow audio from remote streams
                remoteVideo.autoplay = true;

                // Set source and restore opacity
                remoteVideo.srcObject = consumer.combinedStream;
                remoteVideo.style.opacity = '1';
                remoteVideo.style.transition = 'opacity 0.3s ease';

                // Wait for video to be ready before playing to avoid interruption errors
                const tryPlayVideo = (): void => {
                  if (remoteVideo.readyState >= 2) { // HAVE_CURRENT_DATA or better
                    remoteVideo.play().catch(err => {
                      console.warn(`[ActiveSpeakers] Auto-play blocked for ${consumer.userName}:`, err.message);
                    });
                  } else {
                    // Video not ready yet, wait for loadeddata event
                    const onReady = (): void => {
                      remoteVideo.play().catch(err => {
                        console.warn(`[ActiveSpeakers] Auto-play blocked for ${consumer.userName}:`, err.message);
                      });
                      remoteVideo.removeEventListener('loadeddata', onReady);
                      remoteVideo.removeEventListener('canplay', onReady);
                    };

                    remoteVideo.addEventListener('loadeddata', onReady, { once: true });
                    remoteVideo.addEventListener('canplay', onReady, { once: true });

                    // Fallback timeout in case events don't fire
                    setTimeout(() => {
                      remoteVideo.removeEventListener('loadeddata', onReady);
                      remoteVideo.removeEventListener('canplay', onReady);
                    }, 2000);
                  }
                };

                tryPlayVideo();

                // Reduced logging for better performance
                if (changedSlots <= 2) {
                  console.log(`[ActiveSpeakers] Smoothly assigned ${consumer.userName} to slot ${index}`);
                }
              }, 50); // Small delay to ensure smooth transition
            }

            if (remoteVideoUserName) {
              remoteVideoUserName.innerHTML = consumer.userName || '';
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
      // Only log significant changes or performance issues
      if (changedSlots > 0) {
        console.log(`[ActiveSpeakers] Smoothly updated ${changedSlots}/${remoteEls.length} slots in ${processingTime.toFixed(2)}ms`);
      } else if (processingTime > 10) {
        console.warn(`[ActiveSpeakers] Processing took ${processingTime.toFixed(2)}ms (no changes)`);
      }
    });
  };

  const onNewProducersToConsume = async (consumeData: any) => {
    try {
      if (!deviceRef.current || !deviceLoadedRef.current) {
        console.warn('[MediaSoupClient] Device not ready; skip consume.');
        return;
      }
      // CallManager will handle this automatically through its listeners
      // This handler is just for UI updates if needed
      console.log('[MediaSoupClient] New producers to consume:', consumeData);
    } catch (err) {
      console.error('[MediaSoupClient] onNewProducersToConsume failed:', err);
    }
  };

  const handleJoinRoom = async () => {
    if (isJoining || isJoined) {
      console.warn('[MediaSoupClient] Already joining/joined; ignoring joinRoom.');
      return;
    }

    if (!userName.trim() || !roomName.trim()) {
      console.warn('[MediaSoupClient] Missing username or room name.');
      return;
    }

    setIsJoining(true);

    try {
      // Stop preview stream before joining
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
      }

      // 1) join room
      const joinRoomResp: JoinRoomResponse = await socketManagerRef.current!.room.joinRoom(userName, roomName);
      console.log('[MediaSoupClient] joinRoomResp:', joinRoomResp);

      // 2) prepare mediasoup Device
      if (!deviceRef.current) deviceRef.current = new Device();
      if (!deviceLoadedRef.current) {
        await deviceRef.current.load({ routerRtpCapabilities: joinRoomResp.routerRtpCapabilities });
        deviceLoadedRef.current = true;
        
        // Set device in socket manager with call options
        const callOptions: CallManagerOptions = {
          onCallStateChange: (state) => {
            console.log('[CallManager] State changed:', state);
          },
          onError: (error) => {
            console.error('[CallManager] Error:', error);
          }
        };
        socketManagerRef.current!.setDevice(deviceRef.current, callOptions);
      }

      // 3) consume any existing producers - CallManager will handle this automatically
      // No need to manually call requestTransportToConsume

      setIsJoined(true);
    } catch (err) {
      console.error('[MediaSoupClient] joinRoom failed:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleEnableFeed = async () => {
    if (localStreamRef.current) {
      console.warn('[MediaSoupClient] Local stream already enabled.');
      return;
    }

    try {
      const mic2Id = await getMic2();
      
      // Always request both video and audio to allow toggling later
      const constraints: MediaStreamConstraints = {
        video: true, // Always get video track
        audio: mic2Id ? { deviceId: { exact: mic2Id } } : true, // Always get audio track
      };
      
      localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply initial preferences to tracks
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      
      if (videoTrack) {
        videoTrack.enabled = isVideoEnabled;
      }
      if (audioTrack) {
        audioTrack.enabled = isMicEnabled;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        // Optimize local video for smooth playback
        localVideoRef.current.playsInline = true;
        localVideoRef.current.muted = true; // Mute local video to avoid feedback
        localVideoRef.current.autoplay = true;
        localVideoRef.current.play().catch(err => console.warn('Local video autoplay blocked:', err));
      }
      setIsStreamEnabled(true);
      
      // Set initial muted state based on mic preference
      if (!isMicEnabled) {
        setIsMuted(true);
      }
      
      console.log('[EnableFeed] Stream enabled - Video:', isVideoEnabled, 'Audio:', isMicEnabled);
    } catch (err) {
      console.error('[MediaSoupClient] enableFeed failed:', err);
    }
  };

  const handleSendFeed = async () => {
    if (!isJoined) {
      console.warn('[MediaSoupClient] Join the room before sending feed.');
      return;
    }
    if (!deviceRef.current || !deviceLoadedRef.current) {
      console.warn('[MediaSoupClient] Device not ready.');
      return;
    }
    if (!localStreamRef.current) {
      console.warn('[MediaSoupClient] Local stream not enabled.');
      return;
    }

    try {
      // Use CallManager to handle producer creation
      const producerState: ProducerState = await socketManagerRef.current!.call.startProducing(localStreamRef.current);

      console.log('[MediaSoupClient] Producers ready:', {
        audio: producerState.audioProducer?.id,
        video: producerState.videoProducer?.id,
      });

      setIsStreamSent(true);
    } catch (err) {
      console.error('[MediaSoupClient] sendFeed failed:', err);
    }
  };

  const handleMuteAudio = async () => {
    const producerState = socketManagerRef.current?.call?.getProducerState();
    if (!producerState?.audioProducer) {
      console.warn('[MediaSoupClient] No audioProducer yet.');
      return;
    }

    try {
      const shouldMute = !producerState.audioProducer.paused;
      
      // Use CallManager to handle audio toggle
      await socketManagerRef.current!.call.toggleAudio(shouldMute);
      
      // Notify server
      socketManagerRef.current!.room.sendAudioChange(shouldMute ? 'mute' : 'unmute');
      setIsMuted(shouldMute);
    } catch (err) {
      console.error('[MediaSoupClient] muteAudio failed:', err);
    }
  };

  const handleVideoToggle = async () => {
    const producerState = socketManagerRef.current?.call?.getProducerState();
    if (!producerState?.videoProducer) {
      console.warn('[MediaSoupClient] No videoProducer yet.');
      return;
    }

    try {
      const shouldDisable = !producerState.videoProducer.paused;
      
      // Toggle video track in local stream (this affects what we see locally)
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !shouldDisable;
          console.log('[VideoToggle] Local video track enabled:', !shouldDisable);
        }
      }
      
      // Use CallManager to handle video toggle for remote peers
      await socketManagerRef.current!.call.toggleVideo(shouldDisable);
      
      // Update state (this will show/hide the overlay in UI)
      setIsVideoEnabled(!shouldDisable);
      console.log('[VideoToggle] Video', shouldDisable ? 'disabled' : 'enabled');
    } catch (err) {
      console.error('[MediaSoupClient] toggleVideo failed:', err);
    }
  };

  const handleScreenShare = async () => {
    if (!isStreamSent) {
      console.warn('[MediaSoupClient] Send feed before starting screen share.');
      return;
    }

    if (isScreenSharing) {
      // Stop screen sharing
      try {
        await socketManagerRef.current!.call.stopScreenShare();
        
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => {
            try { t.stop(); } catch (e) { }
          });
          screenStreamRef.current = null;
        }
        
        setIsScreenSharing(false);
        console.log('[MediaSoupClient] Screen sharing stopped');
      } catch (err) {
        console.error('[MediaSoupClient] stopScreenShare failed:', err);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as any,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        // Listen for the user stopping screen share via browser UI
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            handleScreenShare(); // This will trigger the stop logic
          };
        }
        
        await socketManagerRef.current!.call.startScreenShare(screenStream);
        setIsScreenSharing(true);
        console.log('[MediaSoupClient] Screen sharing started');
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          console.log('[MediaSoupClient] User cancelled screen share');
        } else {
          console.error('[MediaSoupClient] startScreenShare failed:', err);
        }
      }
    }
  };

  const handleHangUp = async () => {
    try {
      // Clear any pending debounced updates
      if (updateActiveSpeakersTimeoutRef.current) {
        clearTimeout(updateActiveSpeakersTimeoutRef.current);
        updateActiveSpeakersTimeoutRef.current = null;
      }

      // Stop screen sharing if active
      if (isScreenSharing) {
        await handleScreenShare();
      }

      // Use CallManager to cleanup producers and consumers
      await socketManagerRef.current!.call.endCall();

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => {
          try { t.stop(); } catch (e) { }
        });
        localStreamRef.current = null;
      }

      // Clear video elements
      const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
      Array.from(remoteEls).forEach((el: HTMLVideoElement) => { el.srcObject = null; });

      if (localVideoRef.current) localVideoRef.current.srcObject = null;

      // Leave the room
      socketManagerRef.current!.room.leaveRoom();

      // Reset states
      setIsJoined(false);
      setIsStreamEnabled(false);
      setIsStreamSent(false);
      setIsMuted(false);
      setIsScreenSharing(false);
      setPinnedProducerId(null);
    } catch (err) {
      console.error('[MediaSoupClient] hangUp failed:', err);
    }
  };

  // Handle pin/unpin video
  const handlePinVideo = (videoIndex: number) => {
    // Get the producer ID from the video element
    const videoEl = document.getElementById(`remote-video-${videoIndex}`) as HTMLVideoElement;
    if (!videoEl || !videoEl.srcObject) {
      console.warn('[Pin] No video stream at index', videoIndex);
      return;
    }

    const consumers = socketManagerRef.current?.call?.getConsumers() || {};
    
    // Find the producer ID for this video stream
    let foundProducerId: string | null = null;
    for (const [aid, consumer] of Object.entries(consumers)) {
      if (consumer.combinedStream === videoEl.srcObject) {
        foundProducerId = aid;
        break;
      }
    }

    if (foundProducerId) {
      // Toggle pin: if already pinned, unpin it
      if (pinnedProducerId === foundProducerId) {
        setPinnedProducerId(null);
        console.log('[Pin] Unpinned video');
      } else {
        setPinnedProducerId(foundProducerId);
        console.log('[Pin] Pinned video:', foundProducerId);
      }
      
      // Force update active speakers to reflect pin change
      const consumers = socketManagerRef.current?.call?.getConsumers() || {};
      const activeIds = Object.keys(consumers);
      performActiveSpeakersUpdate(activeIds);
    }
  };

  // Render the appropriate component based on join status
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
        onJoinRoom={handleJoinRoom}
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
      onEnableFeed={handleEnableFeed}
      onSendFeed={handleSendFeed}
      onMuteAudio={handleMuteAudio}
      onVideoToggle={handleVideoToggle}
      onScreenShare={handleScreenShare}
      onHangUp={handleHangUp}
      onPinVideo={handlePinVideo}
    />
  );
};

export default VideoConference;
