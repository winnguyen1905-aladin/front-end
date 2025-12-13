import { useState, useCallback } from 'react';
import { useStream } from '@context/StreamContext';
import { v4 as uuidv4 } from 'uuid';
/**
 * Custom hook that wraps StreamContext and provides additional local UI state
 * for the video conference component.
*/
export function useVideoCall() {
  const stream = useStream();
  
  // Local UI state for join form
  const [userId, setUserId] = useState('What is your name ?');
  const [roomId, setRoomId] = useState("Enter Room ID Here"); // G` enerate default UUID
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Wrapped join handler - pass preview settings to auto enable and send
  const handleJoinRoom = useCallback(async () => {
    // If user modified the room ID manually, add random suffix to avoid duplicates
    let finalRoomId = roomId;
    if (roomId !== uuidv4() && !roomId.includes('-')) {
      finalRoomId = `${roomId}-${Math.floor(Math.random() * 10000)}`;
    }
    await stream.joinRoom(userId, finalRoomId, isMicEnabled, stream.isVideoEnabled);
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
