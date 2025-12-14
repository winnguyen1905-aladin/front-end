import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';
import { Transport, Consumer } from 'mediasoup-client/types';
import { playJoinSound, playLeaveSound } from '../utils/sounds';
import {
  createSegmentationProcessor,
  SegmentationProcessor,
  SegmentationMode,
  FaceEnhancementConfig,
} from '../utils/selfieSegmentation';
import {
  getOptimalAudioConstraints,
  createShiguredoNoiseProcessor,
  AudioProcessor,
  createAudioProcessor,
  AudioMetrics,
} from '../utils/shiguredoNoiseProcessor';
import {
  UserInfo,
  ConsumerState,
  ConsumersMap,
  ProducerState,
  NewProducersData,
  createProducerTransport,
  consumeProducers as consumeProducersUtil,
  closeConsumer,
  closeProducers,
  createEmptyProducerState,
  clearVideoElementsForConsumer,
  clearAllRemoteVideos,
} from '../utils/mediasoupUtils';

// Re-export types for consumers
export type { SegmentationMode, FaceEnhancementConfig, AudioMetrics, UserInfo, ConsumerState, ConsumersMap, ProducerState, NewProducersData };

// ==============================
// Types
// ==============================

export interface JoinRoomResponse {
  routerRtpCapabilities: types.RtpCapabilities;
  newRoom: boolean;
  audioPidsToCreate?: string[];
  videoPidsToCreate?: (string | null)[];
  associatedUsers?: UserInfo[];
  roomId?: string;
  ownerId?: string;
  isPasswordProtected?: boolean;
  participantCount?: number;
  error?: string;
}

export interface ConsumerListItem {
  oderId: string;
  odisplayName: string;
}

// Room-related interfaces
export interface RoomParticipant {
  oderId: string;
  displayName: string;
  isOwner: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
}

export interface RoomInfo {
  roomId: string;
  ownerId: string;
  isPasswordProtected: boolean;
  participantCount: number;
  participants: RoomParticipant[];
  createdAt?: number;
}

export interface StreamContextValue {
  // Connection state
  isConnected: boolean;
  socketId: string | undefined;
  
  // Call state
  isJoining: boolean;
  isJoined: boolean;
  isRemoteMediaReady: boolean;
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isNewRoom: boolean;
  consumers: ConsumerListItem[];
  roomInfo: RoomInfo | null;
  
  // Background segmentation state
  isSegmentationEnabled: boolean;
  segmentationMode: SegmentationMode;
  
  // Refs
  localVideoRef: React.RefObject<HTMLVideoElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  
  // Actions
  joinRoom: (userId: string, roomId: string, isMicEnabled?: boolean, isVideoEnabled?: boolean) => Promise<void>;
  enableFeed: (isMicEnabled: boolean, isVideoEnabled: boolean) => Promise<void>;
  sendFeed: () => Promise<void>;
  muteAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  hangUp: () => Promise<void>;
  setIsVideoEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Background segmentation actions
  toggleSegmentation: () => Promise<void>;
  setSegmentationMode: (mode: SegmentationMode) => void;
  setBlurAmount: (amount: number) => void;
  removeBackground: () => void;
  setBackgroundColor: (color: string) => void;
  setVirtualBackground: (bg: string | File) => Promise<void>;
  
  // Face enhancement actions
  faceEnhancement: FaceEnhancementConfig;
  setFaceEnhancement: (config: Partial<FaceEnhancementConfig>) => void;
  
  // Consumer access
  getConsumers: () => ConsumersMap;
  getProducerState: () => ProducerState;
  
  // Stream management
  refreshVideoStreams: () => void;
}

// ==============================
// Context
// ==============================

const StreamContext = createContext<StreamContextValue | null>(null);

export const useStream = (): StreamContextValue => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};

// ==============================
// Stream Provider Props
// ==============================

interface StreamProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

// ==============================
// Stream Provider
// ==============================

export const StreamProvider: React.FC<StreamProviderProps> = ({
  children,
  serverUrl = import.meta.env.VITE_API_URL,
}) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  
  // Call state
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isRemoteMediaReady, setIsRemoteMediaReady] = useState(false);
  const [isStreamEnabled, setIsStreamEnabled] = useState(false);
  const [isStreamSent, setIsStreamSent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isNewRoom, setIsNewRoom] = useState(false);
  const [consumers, setConsumers] = useState<ConsumerListItem[]>([]);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  
  // Segmentation state
  const [isSegmentationEnabled, setIsSegmentationEnabled] = useState(false);
  const [segmentationMode, setSegmentationModeState] = useState<SegmentationMode>('blur');
  const [blurAmountState, setBlurAmountState] = useState(10);
  
  // Face enhancement state
  const [faceEnhancement, setFaceEnhancementState] = useState<FaceEnhancementConfig>({
    enabled: true,
    smoothing: 30,
    whitening: 20,
    sharpening: 25,
  });

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const deviceLoadedRef = useRef(false);
  const consumersRef = useRef<ConsumersMap>({});
  const producerStateRef = useRef<ProducerState>({
    audioProducer: null,
    videoProducer: null,
    screenAudioProducer: null,
    screenVideoProducer: null,
    producerTransport: null,
    screenTransport: null,
  });
  const isConsumingRef = useRef(true);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const updateActiveSpeakersTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Segmentation refs
  const segmentationProcessorRef = useRef<SegmentationProcessor | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null); // Original camera stream before processing
  
  // Audio processing ref (Shiguredo ML-based)
  const audioProcessorRef = useRef<AudioProcessor | null>(null);

  // ==============================
  // Socket Helpers
  // ==============================

  const getSocket = (): Socket => {
    if (!socketRef.current) throw new Error('Socket not connected');
    return socketRef.current;
  };

  const getDevice = (): Device => {
    if (!deviceRef.current) throw new Error('Device not initialized');
    return deviceRef.current;
  };

  const getConsumers = useCallback((): ConsumersMap => {
    return consumersRef.current;
  }, []);

  const getProducerState = useCallback((): ProducerState => {
    return producerStateRef.current;
  }, []);

  // ==============================
  // Consumer Management
  // ==============================

  const consumeProducers = async (data: NewProducersData): Promise<void> => {
    const socket = getSocket();
    const device = getDevice();
    
    consumersRef.current = await consumeProducersUtil(socket, device, data, consumersRef.current);
    updateConsumersState();
  };

  const updateConsumersState = () => {
    const consumerList = Object.entries(consumersRef.current).map(([audioPid, state]) => ({
      oderId: audioPid,
      odisplayName: state.user?.displayName || '',
    }));
    setConsumers(consumerList);

    // Also update room info participants
    setRoomInfo(prev => {
      if (!prev) return prev;
      const participants = Object.entries(consumersRef.current).map(([audioPid, state]) => ({
        oderId: state.user?.id || audioPid,
        displayName: state.user?.displayName || '',
        isOwner: state.user?.id === prev.ownerId,
      }));
      return {
        ...prev,
        participants,
        participantCount: participants.length + 1, // +1 for self
      };
    });
  };

  // ==============================
  // Event Handlers
  // ==============================

  const handleProducerClosed = (data: { producerId: string }): void => {
    for (const [audioPid, state] of Object.entries(consumersRef.current)) {
      const isAudio = state.audioConsumer?.producerId === data.producerId;
      const isVideo = state.videoConsumer?.producerId === data.producerId;

      if (isAudio || isVideo) {
        clearVideoElementsForConsumer(state);

        if (isAudio && state.audioConsumer) {
          state.audioConsumer.close();
          state.audioConsumer = null;
        }
        if (isVideo && state.videoConsumer) {
          state.videoConsumer.close();
          state.videoConsumer = null;
        }

        if (!state.audioConsumer && !state.videoConsumer) {
          state.consumerTransport?.close();
          delete consumersRef.current[audioPid];
        }
        break;
      }
    }
  };

  const handleConsumerPaused = (data: { consumerId: string; kind: 'audio' | 'video' }): void => {
    for (const state of Object.values(consumersRef.current)) {
      const consumer = data.kind === 'audio' ? state.audioConsumer : state.videoConsumer;
      if (consumer?.id === data.consumerId) {
        consumer.pause();
        break;
      }
    }
  };

  const handleConsumerResumed = (data: { consumerId: string; kind: 'audio' | 'video' }): void => {
    for (const state of Object.values(consumersRef.current)) {
      const consumer = data.kind === 'audio' ? state.audioConsumer : state.videoConsumer;
      if (consumer?.id === data.consumerId) {
        consumer.resume();
        break;
      }
    }
  };

  const handleParticipantLeft = (data: { participantId: string }): void => {
    const participantId = data.participantId;
    console.log('[StreamContext] handleParticipantLeft:', participantId);
    let hasRemoved = false;

    Object.entries(consumersRef.current).forEach(([key, state]) => {
      if (state.user && String(state.user.id) === String(participantId)) {
        console.log('[StreamContext] Removing consumer for user:', participantId);
        clearVideoElementsForConsumer(state);
        closeConsumer(state);
        delete consumersRef.current[key];
        hasRemoved = true;
      }
    });

    if (hasRemoved) {
      updateConsumersState();
      playLeaveSound();
    }
  };

  // ==============================
  // Stream Assignment Handler
  // ==============================

  // Assign streams to video elements based on consumers array order
  const assignStreamsToVideoElements = useCallback(() => {
    requestAnimationFrame(() => {
      const consumerEntries = Object.entries(consumersRef.current);
      
      consumerEntries.forEach(([audioPid, consumer], index) => {
        const remoteVideo = document.getElementById(`remote-video-${index}`) as HTMLVideoElement;
        const remoteVideoUserName = document.getElementById(`username-${index}`);

        if (remoteVideo && consumer.combinedStream) {
          // Skip if already assigned
          if (remoteVideo.srcObject === consumer.combinedStream) {
            if (remoteVideo.paused) {
              remoteVideo.play().catch(() => {});
            }
          } else {
            // Assign new stream
            remoteVideo.playsInline = true;
            remoteVideo.muted = false;
            remoteVideo.autoplay = true;
            remoteVideo.srcObject = consumer.combinedStream;

            if (remoteVideo.readyState >= 2) {
              remoteVideo.play().catch(() => {});
            } else {
              remoteVideo.addEventListener('loadeddata', () => {
                remoteVideo.play().catch(() => {});
              }, { once: true });
            }
          }
        }

        if (remoteVideoUserName) {
          remoteVideoUserName.innerHTML = consumer.user?.displayName || '';
        }
      });
    });
  }, []);

  // Handle active speakers update from server - just trigger stream assignment
  const onActiveSpeakersUpdate = useCallback((_newListOfActives: string[]) => {
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
    }

    updateActiveSpeakersTimeoutRef.current = setTimeout(() => {
      updateActiveSpeakersTimeoutRef.current = null;
      assignStreamsToVideoElements();
    }, 100);
  }, [assignStreamsToVideoElements]);

  // Trigger stream assignment when consumers state changes
  useEffect(() => {
    if (consumers.length > 0) {
      // Small delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        assignStreamsToVideoElements();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [consumers, assignStreamsToVideoElements]);

  // ==============================
  // Socket Connection
  // ==============================

  useEffect(() => {
    // Connect to socket.io server with /call namespace
    const socket = io(`${import.meta.env.VITE_SOCKET_URL}`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      retries: 10,
      ackTimeout: 1000000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[StreamContext] Connected to /call namespace:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[StreamContext] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[StreamContext] Connection error:', error);
    });

    // Active speakers events
    socket.on('updateActiveSpeakers', (data: string[] | { activeSpeakers: string[] }) => {
      const speakers = Array.isArray(data) ? data : data.activeSpeakers;
      onActiveSpeakersUpdate(speakers);
    });

    socket.on('activeSpeakersUpdate', (speakers: string[]) => {
      onActiveSpeakersUpdate(speakers);
    });

    // Producer events
    socket.on('newProducersToConsume', async (data: NewProducersData) => {
      isConsumingRef.current = true;
      try {
        await consumeProducers(data);
        // Play join sound when new participant joins
        playJoinSound();
      } finally {
        isConsumingRef.current = false;
        setIsRemoteMediaReady(true);
      }
    });

    socket.on('producerClosed', handleProducerClosed);
    socket.on('producerPaused', (data: { producerId: string }) => {
      console.log('[StreamContext] Producer paused:', data);
    });
    socket.on('producerResumed', (data: { producerId: string }) => {
      console.log('[StreamContext] Producer resumed:', data);
    });

    // Consumer events
    socket.on('consumerPaused', handleConsumerPaused);
    socket.on('consumerResumed', handleConsumerResumed);

    // Participant events
    socket.on('participantLeft', handleParticipantLeft);
    socket.on('userLeft', handleParticipantLeft);

    return () => {
      if (updateActiveSpeakersTimeoutRef.current) {
        clearTimeout(updateActiveSpeakersTimeoutRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, onActiveSpeakersUpdate]);

  // ==============================
  // Preview Video
  // ==============================

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

  // ==============================
  // Actions
  // ==============================

  const joinRoom = async (
    userName: string, 
    roomId: string, 
    isMicEnabled: boolean = true, 
    isVideoEnabled: boolean = true
  ): Promise<void> => {
    if (isJoining || isJoined || !userName.trim() || !roomId.trim()) return;

    setIsJoining(true);
    setIsRemoteMediaReady(false);

    try {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;

      const socket = getSocket();
      const response: JoinRoomResponse = await socket.emitWithAck('joinRoom', {
        userName: userName,
        roomId,
      });

      if (!response?.routerRtpCapabilities) {
        throw new Error('Invalid joinRoom response');
      }

      // Initialize device
      if (!deviceRef.current) {
        deviceRef.current = new Device();
      }

      if (!deviceLoadedRef.current) {
        await deviceRef.current.load({ routerRtpCapabilities: response.routerRtpCapabilities });
        deviceLoadedRef.current = true;
      }

      setIsJoined(true);
      setIsNewRoom(response.newRoom || false);

      // Set room info from server response
      setRoomInfo({
        roomId: response.roomId || roomId,
        ownerId: response.ownerId || '',
        isPasswordProtected: response.isPasswordProtected || false,
        participantCount: response.participantCount || 1,
        participants: response.associatedUsers?.map(user => ({
          oderId: user.id,
          displayName: user.displayName,
          isOwner: user.id === response.ownerId,
        })) || [],
      });

      // Consume existing producers if joining existing room
      if (!response.newRoom && response.audioPidsToCreate && response.audioPidsToCreate.length > 0) {
        console.log('[StreamContext] Joining existing room, consuming producers...');
        isConsumingRef.current = true;
        
        // Consume producers from existing participants
        consumeProducers({
          audioPidsToCreate: response.audioPidsToCreate,
          videoPidsToCreate: response.videoPidsToCreate || [],
          associatedUsers: response.associatedUsers || [],
        }).then(() => {
          console.log('[StreamContext] Finished consuming existing producers');
          isConsumingRef.current = false;
          setIsRemoteMediaReady(true);
        }).catch(err => {
          console.error('[StreamContext] Error consuming producers:', err);
          isConsumingRef.current = false;
          setIsRemoteMediaReady(true);
        });
      } else {
        // New room or no existing producers
        isConsumingRef.current = false;
        setIsRemoteMediaReady(true);
      }

      // Auto enable and send feed after successful join
      console.log('[StreamContext] Auto-enabling feed with mic:', isMicEnabled, 'video:', isVideoEnabled);
      console.log('[StreamContext] Device loaded:', deviceLoadedRef.current, 'Local stream:', !!localStreamRef.current);
      
      await enableFeed(isMicEnabled, isVideoEnabled);
      console.log('[StreamContext] Feed enabled, local stream:', !!localStreamRef.current);
      
      // Wait a bit for state to settle before sending feed
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[StreamContext] Starting sendFeed...');
      await sendFeed();
      console.log('[StreamContext] Feed sent successfully');
      
    } catch (err) {
      console.error('[StreamContext] Join failed:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const enableFeed = async (isMicEnabled: boolean, isVidEnabled: boolean): Promise<void> => {
  console.log('[StreamContext] enableFeed called - mic:', isMicEnabled, 'video:', isVidEnabled);
  console.log('[StreamContext] Current local stream:', !!localStreamRef.current);
  
  if (localStreamRef.current) {
    console.log('[StreamContext] Stream already exists, returning early');
    return;
  }

  try {
    console.log('[StreamContext] Requesting user media...');
    
    // Use optimal audio constraints for WebRTC (AEC + NS + AGC)
    const rawStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: getOptimalAudioConstraints(),
    });
    console.log('[StreamContext] Got user media stream with optimal audio constraints');

    // Store raw stream for later use
    rawStreamRef.current = rawStream;

    // ========== AUDIO PROCESSING (Shiguredo ML-based) ==========
    console.log('[StreamContext] Applying Shiguredo ML audio processing...');
    let processedAudioTrack: MediaStreamTrack | null = null;
    
    try {
      const audioProcessor = await createAudioProcessor(rawStream, {
        targetLevel: 0.3,           // Target output level
      });

      audioProcessorRef.current = audioProcessor;
      
      // Wait for AudioWorklet warm-up phase to complete
      // Warm-up: 20 frames * 128 samples / 48kHz ≈ 53ms + fade-in
      console.log('[StreamContext] Waiting for audio processor warm-up...');
      await new Promise(resolve => setTimeout(resolve, 150));
      
      processedAudioTrack = audioProcessor.getProcessedTrack();
      
      // Verify track is live
      if (processedAudioTrack.readyState !== 'live') {
        throw new Error(`Processed audio track is not live: ${processedAudioTrack.readyState}`);
      }
      
      console.log('[StreamContext] ✅ Shiguredo ML audio processing applied successfully');
      console.log('[StreamContext] Processed audio track state:', processedAudioTrack.readyState);
      
      // Monitor audio levels for debugging
      const metrics = audioProcessor.getMetrics();
      console.log('[StreamContext] Initial audio metrics:', metrics);
      
    } catch (audioError) {
      console.error('[StreamContext] ❌ Shiguredo audio processing failed, using raw audio:', audioError);
      processedAudioTrack = rawStream.getAudioTracks()[0];
    }

    // ========== VIDEO PROCESSING (Background Removal) ==========
    console.log('[StreamContext] Applying background segmentation...');
    let processedVideoTrack: MediaStreamTrack | null = null;
    
    try {
      const processor = await createSegmentationProcessor(rawStream, {
        mode: 'remove', // Remove background by default
        blurAmount: 10,
      });
      
      segmentationProcessorRef.current = processor;
      await processor.start();
      
      const processedStream = processor.getProcessedStream();
      
      if (processedStream) {
        console.log('[StreamContext] Video segmentation applied successfully');
        processedVideoTrack = processedStream.getVideoTracks()[0];
        isSegmentationEnabledRef.current = true;
        setIsSegmentationEnabled(true);
      } else {
        console.warn('[StreamContext] Processed video not available, using raw video');
        processedVideoTrack = rawStream.getVideoTracks()[0];
      }
    } catch (segError) {
      console.error('[StreamContext] Segmentation failed, using raw video:', segError);
      processedVideoTrack = rawStream.getVideoTracks()[0];
    }

    // ========== COMBINE PROCESSED TRACKS ==========
    // Create final stream with processed audio + processed video
    const tracks: MediaStreamTrack[] = [];
    if (processedVideoTrack) tracks.push(processedVideoTrack);
    if (processedAudioTrack) tracks.push(processedAudioTrack);
    
    localStreamRef.current = new MediaStream(tracks);
    console.log('[StreamContext] Combined processed stream created');

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    console.log('[StreamContext] Got tracks - video:', !!videoTrack, 'audio:', !!audioTrack);
    
    // IMPORTANT: Enable tracks BEFORE attaching to video element
    if (videoTrack) {
      videoTrack.enabled = isVidEnabled;
      console.log('[StreamContext] Video track enabled:', videoTrack.enabled);
    }
    if (audioTrack) {
      audioTrack.enabled = isMicEnabled;
      console.log('[StreamContext] Audio track enabled:', audioTrack.enabled);
    }

    // Attach to local video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      
      // FIXED: Ensure video plays with proper volume
      localVideoRef.current.muted = true; // Local preview should be muted
      localVideoRef.current.volume = 1.0;
      
      try {
        await localVideoRef.current.play();
        console.log('[StreamContext] Local video playing');
      } catch (playError) {
        console.error('[StreamContext] Video play failed:', playError);
      }
    }

    // Update state
    setIsStreamEnabled(true);
    if (!isMicEnabled) setIsMuted(true);
    
    // DEBUGGING: Log audio levels periodically
    if (audioProcessorRef.current) {
      const checkAudioInterval = setInterval(() => {
        if (!audioProcessorRef.current?.isRunning()) {
          clearInterval(checkAudioInterval);
          return;
        }
        
        const metrics = audioProcessorRef.current.getMetrics();
        console.log('[StreamContext] Audio metrics:', {
          input: metrics.inputLevel.toFixed(4),
          output: metrics.outputLevel.toFixed(4),
          voiceActive: metrics.isVoiceActive,
        });
      }, 2000);
      
      // Clear interval after 10 seconds
      setTimeout(() => clearInterval(checkAudioInterval), 10000);
    }
    
    console.log('[StreamContext] ✅ enableFeed completed successfully');
    
  } catch (err) {
    console.error('[StreamContext] ❌ Enable feed failed:', err);
    throw err; // Re-throw to handle in caller
  }
};

  const sendFeed = async (): Promise<void> => {
    // Check device and stream are ready (not isJoined state since it may not be updated yet)
    if (!deviceLoadedRef.current || !localStreamRef.current) {
      console.warn('[StreamContext] Cannot send feed - device or stream not ready');
      return;
    }

    try {
      console.log('[StreamContext] Creating producer transport...');
      const producerTransport = await createProducerTransport(getSocket(), getDevice());

      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      console.log('[StreamContext] Tracks - video:', !!videoTrack, 'audio:', !!audioTrack);

      const videoProducer = videoTrack
        ? await producerTransport.produce({ track: videoTrack })
        : null;
      const audioProducer = audioTrack
        ? await producerTransport.produce({ track: audioTrack })
        : null;

      console.log('[StreamContext] Producers created - video:', !!videoProducer, 'audio:', !!audioProducer);

      producerStateRef.current = {
        ...producerStateRef.current,
        audioProducer,
        videoProducer,
        producerTransport,
      };

      console.log('[StreamContext] Producer state updated:', producerStateRef.current);
      setIsStreamSent(true);
    } catch (err) {
      console.error('[StreamContext] Send feed failed:', err);
    }
  };

  const muteAudio = async (): Promise<void> => {
    const state = producerStateRef.current;
    console.log('[StreamContext] muteAudio - producer state:', state);
    
    if (!state.audioProducer) {
      console.warn('[StreamContext] No audio producer available');
      return;
    }

    const shouldMute = !state.audioProducer.paused;
    console.log('[StreamContext] Audio toggle - shouldMute:', shouldMute);

    if (shouldMute) {
      await state.audioProducer.pause();
    } else {
      await state.audioProducer.resume();
    }

    socketRef.current?.emit('audioChange', { action: shouldMute ? 'mute' : 'unmute' });
    setIsMuted(shouldMute);
  };

  const toggleVideo = async (): Promise<void> => {
    const state = producerStateRef.current;
    console.log('[StreamContext] toggleVideo - producer state:', state);
    
    if (!state.videoProducer) {
      console.warn('[StreamContext] No video producer available');
      return;
    }

    const shouldDisable = !state.videoProducer.paused;
    console.log('[StreamContext] Video toggle - shouldDisable:', shouldDisable);

    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) track.enabled = !shouldDisable;
    }

    if (shouldDisable) {
      await state.videoProducer.pause();
    } else {
      await state.videoProducer.resume();
    }

    setIsVideoEnabled(!shouldDisable);
  };

  const toggleScreenShare = async (): Promise<void> => {
    if (!isStreamSent) return;

    if (isScreenSharing) {
      // Stop screen share
      const producerIds: string[] = [];
      const state = producerStateRef.current;

      if (state.screenAudioProducer) {
        producerIds.push(state.screenAudioProducer.id);
        state.screenAudioProducer.close();
        state.screenAudioProducer = null;
      }

      if (state.screenVideoProducer) {
        producerIds.push(state.screenVideoProducer.id);
        state.screenVideoProducer.close();
        state.screenVideoProducer = null;
      }

      if (state.screenTransport) {
        state.screenTransport.close();
        state.screenTransport = null;
      }

      if (producerIds.length > 0) {
        socketRef.current?.emit('closeProducers', { producerIds });
      }

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

        const screenTransport = await createProducerTransport(getSocket(), getDevice());
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        const screenVideoProducer = videoTrack
          ? await screenTransport.produce({ track: videoTrack, appData: { source: 'screen' } })
          : null;
        const screenAudioProducer = audioTrack
          ? await screenTransport.produce({ track: audioTrack, appData: { source: 'screen' } })
          : null;

        producerStateRef.current.screenVideoProducer = screenVideoProducer;
        producerStateRef.current.screenAudioProducer = screenAudioProducer;
        producerStateRef.current.screenTransport = screenTransport;

        setIsScreenSharing(true);
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.error('[StreamContext] Screen share failed:', err);
        }
      }
    }
  };

  // ==============================
  // Segmentation Functions
  // ==============================

  // Use ref to track segmentation state to avoid stale closure issues
  const isSegmentationEnabledRef = useRef(false);
  
  const toggleSegmentation = async (): Promise<void> => {
    // Toggle the segmentation mode (remove vs none)
    const currentlyEnabled = isSegmentationEnabledRef.current;
    console.log('[StreamContext] toggleSegmentation called, currently enabled:', currentlyEnabled);

    if (currentlyEnabled) {
      // Switch to 'none' mode (show original video through same canvas)
      console.log('[StreamContext] Switching to no background effect');
      isSegmentationEnabledRef.current = false;
      setIsSegmentationEnabled(false);
      
      if (segmentationProcessorRef.current) {
        segmentationProcessorRef.current.setMode('none');
      }
    } else {
      // Switch to 'remove' mode
      console.log('[StreamContext] Switching to background removal');
      isSegmentationEnabledRef.current = true;
      setIsSegmentationEnabled(true);
      
      if (segmentationProcessorRef.current) {
        segmentationProcessorRef.current.setMode('remove');
      }
    }
  };

  const setSegmentationMode = (mode: SegmentationMode): void => {
    setSegmentationModeState(mode);
    if (segmentationProcessorRef.current) {
      segmentationProcessorRef.current.setMode(mode);
    }
  };

  const setBlurAmount = (amount: number): void => {
    setBlurAmountState(amount);
    if (segmentationProcessorRef.current) {
      segmentationProcessorRef.current.setBlurAmount(amount);
    }
  };

  const removeBackground = (): void => {
    // Enable segmentation if not already enabled
    if (!isSegmentationEnabled) {
      toggleSegmentation();
    }
    // Set mode to remove
    setSegmentationMode('remove');
  };

  const setBackgroundColor = (color: string): void => {
    if (segmentationProcessorRef.current) {
      segmentationProcessorRef.current.setBackgroundColor(color);
    }
  };

  const setVirtualBackground = async (bg: string | File): Promise<void> => {
    if (segmentationProcessorRef.current) {
      await segmentationProcessorRef.current.setVirtualBackground(bg);
      setSegmentationModeState('virtual');
      if (!isSegmentationEnabled) {
        isSegmentationEnabledRef.current = true;
        setIsSegmentationEnabled(true);
      }
    }
  };

  const setFaceEnhancement = (config: Partial<FaceEnhancementConfig>): void => {
    setFaceEnhancementState(prev => {
      const newConfig = { ...prev, ...config };
      if (segmentationProcessorRef.current) {
        segmentationProcessorRef.current.setFaceEnhancement(newConfig);
      }
      return newConfig;
    });
  };

  const hangUp = async (): Promise<void> => {
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
      updateActiveSpeakersTimeoutRef.current = null;
    }

    if (isScreenSharing) await toggleScreenShare();

    // Stop segmentation processor
    if (segmentationProcessorRef.current) {
      segmentationProcessorRef.current.stop();
      segmentationProcessorRef.current = null;
    }

    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
      audioProcessorRef.current = null;
    }

    // Close producers and consumers using utils
    closeProducers(producerStateRef.current);
    for (const consumerState of Object.values(consumersRef.current)) {
      closeConsumer(consumerState);
    }

    // Cleanup refs
    consumersRef.current = {};
    producerStateRef.current = createEmptyProducerState();

    // Stop both raw and processed streams
    rawStreamRef.current?.getTracks().forEach(t => t.stop());
    rawStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    clearAllRemoteVideos();
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    socketRef.current?.emit('leaveRoom');

    setIsJoined(false);
    setIsRemoteMediaReady(false);
    setIsStreamEnabled(false);
    setIsStreamSent(false);
    setIsMuted(false);
    setIsScreenSharing(false);
    setIsNewRoom(false);
    setConsumers([]);
    setRoomInfo(null);
    setIsSegmentationEnabled(false);
  };

  // ==============================
  // Context Value
  // ==============================

  const contextValue: StreamContextValue = {
    // Connection state
    isConnected,
    socketId: socketRef.current?.id,
    
    // Call state
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
    roomInfo,
    
    // Background segmentation state
    isSegmentationEnabled,
    segmentationMode,
    
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
    setIsVideoEnabled,
    setIsMuted,
    
    // Background segmentation actions
    toggleSegmentation,
    setSegmentationMode,
    setBlurAmount,
    removeBackground,
    setBackgroundColor,
    setVirtualBackground,
    
    // Face enhancement
    faceEnhancement,
    setFaceEnhancement,
    
    // Consumer access
    getConsumers,
    getProducerState,
    
    // Stream management
    refreshVideoStreams: assignStreamsToVideoElements,
  };

  return (
    <StreamContext.Provider value={contextValue}>
      {children}
    </StreamContext.Provider>
  );
};

export default StreamContext;
