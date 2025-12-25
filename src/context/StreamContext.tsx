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
  screenShareClientId: string | null;
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
  const [screenShareClientId, setScreenShareClientId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
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
  const screenShareSocketRef = useRef<Socket | null>(null);
  const screenShareDeviceRef = useRef<Device | null>(null);
  const screenShareProducerStateRef = useRef<ProducerState>({
    audioProducer: null,
    videoProducer: null,
    screenAudioProducer: null,
    screenVideoProducer: null,
    producerTransport: null,
    screenTransport: null,
  });
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

  const getScreenShareSocket = (): Socket => {
    if (!screenShareSocketRef.current) throw new Error('Screen share socket not connected');
    return screenShareSocketRef.current;
  };

  const getScreenShareDevice = (): Device => {
    if (!screenShareDeviceRef.current) throw new Error('Screen share device not initialized');
    return screenShareDeviceRef.current;
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

      // Store current user and room info
      setCurrentUserName(userName);
      setCurrentRoomId(response.roomId || roomId);
      
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

  // ==============================
  // Screen Share Virtual Client
  // ==============================

  const joinScreenShareRoom = async (
    originalUserName: string,
    roomId: string,
    screenStream: MediaStream
  ): Promise<void> => {
    console.log('[StreamContext] Starting screen share virtual client join...');
    
    try {
      // Create separate socket connection for screen share
      const screenShareSocket = io(`${import.meta.env.VITE_SOCKET_URL}`, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        retries: 10,
        ackTimeout: 1000000,
      });

      screenShareSocketRef.current = screenShareSocket;

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        screenShareSocket.on('connect', () => {
          console.log('[StreamContext] Screen share client connected:', screenShareSocket.id);
          setScreenShareClientId(screenShareSocket.id || null);
          resolve();
        });
        screenShareSocket.on('connect_error', (error) => {
          console.error('[StreamContext] Screen share client connection error:', error);
          reject(error);
        });
      });

      // Join room as virtual screen share client
      const screenShareUserName = `${originalUserName} (Screen)`;
      const response: JoinRoomResponse = await screenShareSocket.emitWithAck('joinRoom', {
        userName: screenShareUserName,
        roomId,
        isScreenShareClient: true,
      });

      if (!response?.routerRtpCapabilities) {
        throw new Error('Invalid joinRoom response for screen share client');
      }

      console.log('[StreamContext] Screen share client joined room successfully');

      // Initialize device for screen share client
      if (!screenShareDeviceRef.current) {
        screenShareDeviceRef.current = new Device();
      }

      await screenShareDeviceRef.current.load({ 
        routerRtpCapabilities: response.routerRtpCapabilities 
      });
      console.log('[StreamContext] Screen share device loaded');

      // Create producer transport for screen share
      const screenTransport = await createProducerTransport(
        getScreenShareSocket(),
        getScreenShareDevice()
      );
      console.log('[StreamContext] Screen share transport created');

      // Create producers for screen video and audio
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];

      const screenVideoProducer = videoTrack
        ? await screenTransport.produce({ 
            track: videoTrack, 
            appData: { source: 'screen', isScreenShare: true } 
          })
        : null;

      const screenAudioProducer = audioTrack
        ? await screenTransport.produce({ 
            track: audioTrack, 
            appData: { source: 'screen', isScreenShare: true } 
          })
        : null;

      console.log('[StreamContext] Screen share producers created - video:', !!screenVideoProducer, 'audio:', !!screenAudioProducer);

      // Store screen share producer state
      screenShareProducerStateRef.current = {
        audioProducer: null,
        videoProducer: null,
        screenAudioProducer,
        screenVideoProducer,
        producerTransport: null,
        screenTransport,
      };

      // Emit screen share status
      screenShareSocket.emit('screenShareChange', { action: 'start' });
      console.log('[StreamContext] Screen share virtual client setup completed');
      
    } catch (err) {
      console.error('[StreamContext] Screen share virtual client join failed:', err);
      // Clean up on error
      await leaveScreenShareRoom();
      throw err;
    }
  };

  const leaveScreenShareRoom = async (): Promise<void> => {
    console.log('[StreamContext] Disconnecting screen share virtual client...');
    
    try {
      const screenShareSocket = screenShareSocketRef.current;
      const screenShareState = screenShareProducerStateRef.current;

      // Close producers first
      if (screenShareState.screenAudioProducer) {
        console.log('[StreamContext] Closing screen share audio producer');
        screenShareState.screenAudioProducer.close();
        screenShareState.screenAudioProducer = null;
      }

      if (screenShareState.screenVideoProducer) {
        console.log('[StreamContext] Closing screen share video producer');
        screenShareState.screenVideoProducer.close();
        screenShareState.screenVideoProducer = null;
      }

      if (screenShareState.screenTransport) {
        console.log('[StreamContext] Closing screen share transport');
        screenShareState.screenTransport.close();
        screenShareState.screenTransport = null;
      }

      // Directly disconnect socket without calling leaveRoom
      // This will automatically remove the virtual client from the room
      if (screenShareSocket) {
        console.log('[StreamContext] Disconnecting screen share socket directly');
        screenShareSocket.disconnect();
        screenShareSocketRef.current = null;
      }

      // Reset screen share device
      if (screenShareDeviceRef.current) {
        screenShareDeviceRef.current = null;
      }

      // Reset state
      screenShareProducerStateRef.current = {
        audioProducer: null,
        videoProducer: null,
        screenAudioProducer: null,
        screenVideoProducer: null,
        producerTransport: null,
        screenTransport: null,
      };
      
      setScreenShareClientId(null);
      console.log('[StreamContext] Screen share virtual client disconnected successfully');
      console.log('[StreamContext] Main user instance remains connected and unaffected');
      
    } catch (err) {
      console.error('[StreamContext] Error disconnecting screen share virtual client:', err);
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

    // ========== VIDEO PROCESSING (Background Segmentation) ==========
    // Initialize processor with mode 'none' - user can enable background effects manually
    console.log('[StreamContext] Initializing segmentation processor with mode none...');
    let processedVideoTrack: MediaStreamTrack | null = null;
    
    try {
      const processor = await createSegmentationProcessor(rawStream, {
        mode: 'none', // Start with no background effect
        blurAmount: 10,
      });
      
      segmentationProcessorRef.current = processor;
      await processor.start();
      
      const processedStream = processor.getProcessedStream();
      
      if (processedStream) {
        console.log('[StreamContext] Segmentation processor ready (mode: none)');
        processedVideoTrack = processedStream.getVideoTracks()[0];
      } else {
        console.warn('[StreamContext] Processed video not available, using raw video');
        processedVideoTrack = rawStream.getVideoTracks()[0];
      }
    } catch (segError) {
      console.error('[StreamContext] Segmentation init failed, using raw video:', segError);
      processedVideoTrack = rawStream.getVideoTracks()[0];
    }
    
    // Segmentation is disabled by default (mode: none)
    isSegmentationEnabledRef.current = false;
    setIsSegmentationEnabled(false);

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
    console.log('[StreamContext] toggleScreenShare - stream sent:', isStreamSent, 'currently sharing:', isScreenSharing);
    
    if (!isStreamSent) {
      console.warn('[StreamContext] Stream not sent yet, cannot toggle screen share');
      return;
    }

    if (!currentUserName || !currentRoomId) {
      console.error('[StreamContext] Cannot start screen share - missing user or room info');
      return;
    }

    if (isScreenSharing) {
      console.log('[StreamContext] Stopping screen share virtual client');
      try {
        // Leave screen share room (virtual client)
        await leaveScreenShareRoom();
        
        // Stop screen stream
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        
        setIsScreenSharing(false);
        console.log('[StreamContext] Screen share virtual client stopped successfully');
      } catch (err) {
        console.error('[StreamContext] Error stopping screen share virtual client:', err);
        setIsScreenSharing(false);
      }
    } else {
      console.log('[StreamContext] Starting screen share virtual client');
      try {
        // Try different configurations for maximum browser compatibility
        let stream: MediaStream;
        console.log('[StreamContext] Browser:', navigator.userAgent);
        
        try {
          console.log('[StreamContext] Attempting optimized screen capture...');
          // Use minimal constraints for maximum compatibility
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            } as any,
            audio: true,
            // Request all sources to be available in picker
            preferCurrentTab: false
          } as any);
          
          console.log('[StreamContext] Successfully obtained display media with optimized config');
        } catch (optimizedErr) {
          console.log('[StreamContext] Optimized config failed, trying basic config...', optimizedErr);
          
          try {
            // Most basic configuration - should work on all browsers
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true
            });
            console.log('[StreamContext] Successfully obtained display media with basic config');
          } catch (basicErr) {
            console.error('[StreamContext] All screen capture configs failed:', basicErr);
            throw basicErr;
          }
        }

        // Log detailed information about the captured stream
        console.log('[StreamContext] Screen capture stream obtained:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // Log video track details for debugging
        if (stream.getVideoTracks().length > 0) {
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          console.log('[StreamContext] Video track settings:', {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            displaySurface: (settings as any).displaySurface,
            cursor: (settings as any).cursor,
            label: videoTrack.label
          });
          
          // Check what type of surface was actually captured
          if (settings.displaySurface) {
            console.log('[StreamContext] Captured surface type:', settings.displaySurface);
            if (settings.displaySurface === 'browser') {
              console.warn('[StreamContext] ⚠️  Only browser tab was captured - desktop apps not available');
            } else if (settings.displaySurface === 'window') {
              console.log('[StreamContext] ✅ Application window captured successfully');
            } else if (settings.displaySurface === 'monitor') {
              console.log('[StreamContext] ✅ Full screen/monitor captured successfully');
            }
          }
        }

        screenStreamRef.current = stream;
        
        // Handle when user stops screen share from browser UI
        stream.getVideoTracks()[0].onended = () => {
          console.log('[StreamContext] Screen share ended by user from browser UI');
          toggleScreenShare();
        };

        // Join room as virtual screen share client
        await joinScreenShareRoom(currentUserName, currentRoomId, stream);
        
        setIsScreenSharing(true);
        console.log('[StreamContext] Screen share virtual client started successfully');
      } catch (err: any) {
        console.error('[StreamContext] Screen share virtual client failed:', err);
        if (err.name === 'NotAllowedError') {
          console.warn('[StreamContext] Screen share permission denied by user');
        } else if (err.name === 'NotSupportedError') {
          console.error('[StreamContext] Screen share not supported by browser');
        } else if (err.name === 'AbortError') {
          console.warn('[StreamContext] Screen share cancelled by user');
        }
        // Reset state on error
        setIsScreenSharing(false);
        // Clean up stream if created
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
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
    setCurrentUserName('');
    setCurrentRoomId('');
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
    screenShareClientId,
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
