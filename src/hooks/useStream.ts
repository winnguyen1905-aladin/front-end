import { useState, useCallback } from 'react';
import { useStream } from '@context/StreamContext';

/**
 * Custom hook that wraps StreamContext and provides additional local UI state
 * for the video conference component.
*/
export function useVideoCall() {
  const stream = useStream();
  
  // Local UI state for join form
  const [userId, setUserId] = useState('user');
  const [roomId, setRoomId] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Wrapped join handler
  const handleJoinRoom = useCallback(async () => {
    await stream.joinRoom(userId, roomId);
  }, [stream, userId, roomId]);

  // Wrapped enable feed handler
  const handleEnableFeed = useCallback(async () => {
    await stream.enableFeed(isMicEnabled, stream.isVideoEnabled);
  }, [stream, isMicEnabled]);

  // const kickUser = useCallback(async () => {
  //   await stream.kickUser(stream.roomId, stream.userId);
  // }, [stream]);

  // const leaveRoom = useCallback(async () => {
  //   await stream.leaveRoom();
  // }, [stream]);

  // const 
  

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
    handleEnableFeed,
  };
}

export default useVideoCall;
