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
import { Transport, Producer, Consumer } from 'mediasoup-client/types';
import { playJoinSound, playLeaveSound } from '../utils/sounds';

// ==============================
// Types
// ==============================

export interface UserInfo {
  id: string;
  displayName: string;
}

export interface ConsumerState {
  combinedStream: MediaStream;
  user: UserInfo;
  consumerTransport?: Transport;
  audioConsumer?: Consumer | null;
  videoConsumer?: Consumer | null;
}

export interface ConsumersMap {
  [audioPid: string]: ConsumerState;
}

export interface ProducerState {
  audioProducer: Producer | null;
  videoProducer: Producer | null;
  screenAudioProducer: Producer | null;
  screenVideoProducer: Producer | null;
  producerTransport: Transport | null;
  screenTransport: Transport | null;
}

export interface JoinRoomResponse {
  routerRtpCapabilities: types.RtpCapabilities;
  newRoom: boolean;
  audioPidsToCreate?: string[];
  videoPidsToCreate?: (string | null)[];
  associatedUsers?: UserInfo[];
  // Room info from server
  roomId?: string;
  ownerId?: string;
  isPasswordProtected?: boolean;
  participantCount?: number;
  error?: string;
}

export interface NewProducersData {
  audioPidsToCreate: string[];
  videoPidsToCreate: (string | null)[];
  associatedUsers: UserInfo[];
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

  const createConsumer = async (
    transport: Transport,
    pid: string,
    kind: 'audio' | 'video'
  ): Promise<Consumer | null> => {
    const socket = getSocket();
    const device = getDevice();

    try {
      const consumerParams = await socket.emitWithAck('consumeMedia', {
        rtpCapabilities: device.rtpCapabilities,
        pid,
        kind,
      });

      if (consumerParams === 'cannotConsume' || consumerParams === 'consumeFailed') {
        return null;
      }

      const consumer = await transport.consume(consumerParams);
      socket.emitWithAck('unpauseConsumer', { pid, kind }).catch(console.error);

      return consumer;
    } catch (error) {
      console.error('[StreamContext] Create consumer failed:', error);
      return null;
    }
  };

  const consumeProducers = async (data: NewProducersData): Promise<void> => {
    const socket = getSocket();
    const device = getDevice();

    const { audioPidsToCreate, videoPidsToCreate, associatedUsers } = data;

    for (let i = 0; i < audioPidsToCreate.length; i++) {
      const audioPid = audioPidsToCreate[i];
      const videoPid = videoPidsToCreate[i];
      const user = associatedUsers[i];

      // Skip if consumer already exists
      if (consumersRef.current[audioPid]) {
        console.log('[StreamContext] Consumer already exists:', audioPid);
        continue;
      }

      try {
        const transportParams = await socket.emitWithAck('requestTransport', {
          type: 'consumer',
          audioPid,
        });

        const consumerTransport = device.createRecvTransport(transportParams);

        consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            const result = await socket.emitWithAck('connectTransport', {
              dtlsParameters,
              type: 'consumer',
              audioPid,
            });
            result === 'success' ? callback() : errback(new Error('Connect failed'));
          } catch (err) {
            errback(err as Error);
          }
        });

        const audioConsumer = await createConsumer(consumerTransport, audioPid, 'audio');
        const videoConsumer = videoPid
          ? await createConsumer(consumerTransport, videoPid, 'video')
          : null;

        const tracks: MediaStreamTrack[] = [];
        if (audioConsumer?.track) tracks.push(audioConsumer.track);
        if (videoConsumer?.track) tracks.push(videoConsumer.track);

        consumersRef.current[audioPid] = {
          combinedStream: new MediaStream(tracks),
          user,
          consumerTransport,
          audioConsumer,
          videoConsumer,
        };
      } catch (error) {
        console.error('[StreamContext] Failed to consume:', audioPid, error);
      }
    }

    // Update consumers state for UI
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
  // Producer Helpers
  // ==============================

  const createProducerTransport = async (): Promise<Transport> => {
    const socket = getSocket();
    const device = getDevice();

    const transportParams = await socket.emitWithAck('requestTransport', { type: 'producer' });
    const producerTransport = device.createSendTransport(transportParams);

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        const result = await socket.emitWithAck('connectTransport', {
          dtlsParameters,
          type: 'producer',
        });
        result === 'success' ? callback() : errback(new Error('Connect failed'));
      } catch (err) {
        errback(err as Error);
      }
    });

    producerTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const isScreen = appData?.source === 'screen';
        const streamKind = isScreen ? (kind === 'audio' ? 'screenAudio' : 'screenVideo') : kind;

        const producerId = await socket.emitWithAck('startProducing', {
          kind: streamKind,
          rtpParameters,
        });

        producerId === 'error'
          ? errback(new Error('Produce failed'))
          : callback({ id: producerId });
      } catch (err) {
        errback(err as Error);
      }
    });

    return producerTransport;
  };

  // ==============================
  // Event Handlers
  // ==============================

  const clearVideoElementsForConsumer = (consumerState: ConsumerState): void => {
    try {
      const remoteVideos = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
      for (let i = 0; i < remoteVideos.length; i++) {
        const videoEl = remoteVideos[i];
        if (videoEl.srcObject === consumerState.combinedStream) {
          videoEl.srcObject = null;
          const usernameEl = document.getElementById(`username-${i}`);
          if (usernameEl) usernameEl.innerHTML = '';
        }
      }
    } catch (error) {
      console.warn('[StreamContext] Error clearing video elements:', error);
    }
  };

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

    // Iterate through all consumers to find ones belonging to the participant
    Object.entries(consumersRef.current).forEach(([key, state]) => {
      console.log('[StreamContext] Checking consumer:', key, 'User:', state.user);
      // Check if user ID matches (handle potential type mismatches)
      if (state.user && String(state.user.id) === String(participantId)) {
        console.log('[StreamContext] Removing consumer for user:', participantId);
        clearVideoElementsForConsumer(state);
        state.audioConsumer?.close();
        state.videoConsumer?.close();
        state.consumerTransport?.close();
        delete consumersRef.current[key];
        hasRemoved = true;
      }
    });

    if (hasRemoved) {
      // Update consumers state for UI
      updateConsumersState();
      // Play leave sound when participant leaves
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
    const socket = io(`http://localhost:8090`, {
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
    userId: string, 
    roomId: string, 
    isMicEnabled: boolean = true, 
    isVideoEnabled: boolean = true
  ): Promise<void> => {
    if (isJoining || isJoined || !userId.trim() || !roomId.trim()) return;

    setIsJoining(true);
    setIsRemoteMediaReady(false);

    try {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;

      const socket = getSocket();
      const response: JoinRoomResponse = await socket.emitWithAck('joinRoom', {
        userId: (Math.random() * 1000).toString(),
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log('[StreamContext] Got user media stream');

      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      console.log('[StreamContext] Got tracks - video:', !!videoTrack, 'audio:', !!audioTrack);
      
      if (videoTrack) videoTrack.enabled = isVidEnabled;
      if (audioTrack) audioTrack.enabled = isMicEnabled;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsStreamEnabled(true);
      if (!isMicEnabled) setIsMuted(true);
      console.log('[StreamContext] enableFeed completed');
    } catch (err) {
      console.error('[StreamContext] Enable feed failed:', err);
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
      const producerTransport = await createProducerTransport();

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

        const screenTransport = await createProducerTransport();
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

  const hangUp = async (): Promise<void> => {
    if (updateActiveSpeakersTimeoutRef.current) {
      clearTimeout(updateActiveSpeakersTimeoutRef.current);
      updateActiveSpeakersTimeoutRef.current = null;
    }

    if (isScreenSharing) await toggleScreenShare();

    // Close producers
    const state = producerStateRef.current;
    state.audioProducer?.close();
    state.videoProducer?.close();
    state.screenAudioProducer?.close();
    state.screenVideoProducer?.close();
    state.producerTransport?.close();
    state.screenTransport?.close();

    // Close consumers
    for (const consumerState of Object.values(consumersRef.current)) {
      consumerState.audioConsumer?.close();
      consumerState.videoConsumer?.close();
      consumerState.consumerTransport?.close();
    }

    // Cleanup refs
    consumersRef.current = {};
    producerStateRef.current = {
      audioProducer: null,
      videoProducer: null,
      screenAudioProducer: null,
      screenVideoProducer: null,
      producerTransport: null,
      screenTransport: null,
    };

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    const remoteEls = document.getElementsByClassName('remote-video') as HTMLCollectionOf<HTMLVideoElement>;
    Array.from(remoteEls).forEach(el => { el.srcObject = null; });
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
