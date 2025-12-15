import React, { useState, useEffect } from 'react';
import { RoomInfo } from '@context/StreamContext';

interface TopBarProps {
  isVisible: boolean;
  roomInfo: RoomInfo | null;
  onShowParticipants?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ isVisible, roomInfo, onShowParticipants }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const copyRoomId = () => {
    if (roomInfo?.roomId) {
      navigator.clipboard.writeText(roomInfo.roomId).then(() => {
        setShowCopiedToast(true);
        setTimeout(() => setShowCopiedToast(false), 2000);
      });
    }
  };

  return (
    <div 
      className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Room Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">Streaming</span>
          </div>
          
          {roomInfo && (
            <>
              <div className="h-4 w-px bg-white/30" />
              <button
                onClick={copyRoomId}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group"
                title="Click to copy Room ID"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-white text-sm font-mono">{roomInfo.roomId}</span>
                {/* <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg> */}
              </button>

              {roomInfo.isPasswordProtected && (
                <div className="flex items-center gap-1 text-yellow-400" title="Password protected">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Participants & Time */}
        <div className="flex items-center gap-4">
          {roomInfo && (
            <button
              onClick={onShowParticipants}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-white text-sm font-medium">{roomInfo.participantCount}</span>
            </button>
          )}
          
          <div className="text-white/80 text-sm font-mono">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Copied Toast */}
      {showCopiedToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Room ID copied!
        </div>
      )}
    </div>
  );
};

export default TopBar;
