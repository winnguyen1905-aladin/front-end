import { useState, useCallback, useEffect } from 'react';
import { useStream } from '@context/StreamContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Generate room ID
const generateRoomId = (): string => {
  return 'xxx-xxxx-xxx'.replace(/[x]/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  });
};

/**
 * Custom hook that wraps StreamContext and provides additional local UI state
 * for the video conference component.
*/
export function useVideoCall() {
  const stream = useStream();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get room ID from URL params
  const roomFromUrl = searchParams.get('room');
  
  // Local UI state for join form
  const [userId, setUserId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Auto-generate room ID if not in URL
  useEffect(() => {
    if (!roomFromUrl) {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      navigate(`/conference?room=${newRoomId}`, { replace: true });
    } else {
      setRoomId(roomFromUrl);
    }
  }, [roomFromUrl, navigate]);

  // Load username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('meetingUserName');
    console.log('🎯 useVideoCall - Loading username from localStorage:', savedUsername);
    if (savedUsername) {
      setUserId(savedUsername);
    }
  }, []);

  // Auto-join disabled - let users manually join through JoinForm
  // useEffect(() => {
  //   console.log('🎯 useVideoCall - Auto-join check:', {
  //     roomId,
  //     userId,
  //     isJoined: stream.isJoined,
  //     isJoining: stream.isJoining,
  //     roomFromUrl
  //   });
    
  //   if (roomId && userId && !stream.isJoined && !stream.isJoining) {
  //     console.log('🎯 useVideoCall - Attempting auto-join...');
  //     // Auto-join after a short delay to ensure everything is initialized
  //     setTimeout(() => {
  //       console.log('🎯 useVideoCall - Calling joinRoom with:', { userId, roomId, isMicEnabled });
  //       stream.joinRoom(userId, roomId, isMicEnabled, stream.isVideoEnabled);
  //     }, 1000);
  //   }
  // }, [roomId, userId, stream.isJoined, stream.isJoining]);

  // Wrapped join handler - pass preview settings to auto enable and send
  const handleJoinRoom = useCallback(async () => {
    // If user modified the room ID manually, add random suffix to avoid duplicates
    await stream.joinRoom(userId, roomId, isMicEnabled, stream.isVideoEnabled);
  }, [stream, userId, roomId, isMicEnabled]);

  return {
    // From StreamContext
    ...stream,
    
    // Local UI state
    userId,
    setUserId,
    roomId,
    setRoomId,
    isMicEnabled,
    setIsMicEnabled,
    
    // Wrapped handlers
    handleJoinRoom,
  };
}

export default useVideoCall;
