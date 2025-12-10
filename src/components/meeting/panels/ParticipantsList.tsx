import React from 'react';
import { RoomInfo, RoomParticipant } from '@context/StreamContext';

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
  roomInfo: RoomInfo | null;
  currentUserId?: string;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  isOpen,
  onClose,
  roomInfo,
  currentUserId,
}) => {
  if (!isOpen) return null;

  const participants = roomInfo?.participants || [];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-[#202124] z-50 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h2 className="text-white font-semibold">
              Participants ({roomInfo?.participantCount || 0})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Current User (You) */}
          <ParticipantItem
            participant={{
              oderId: currentUserId || 'you',
              displayName: 'You',
              isOwner: roomInfo?.ownerId === currentUserId,
            }}
            isCurrentUser
          />

          {/* Other Participants */}
          {participants.map((participant) => (
            <ParticipantItem
              key={participant.oderId}
              participant={participant}
              isCurrentUser={false}
            />
          ))}

          {/* Empty State */}
          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-16 h-16 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-white/50 text-sm">Waiting for others to join...</p>
            </div>
          )}
        </div>

        {/* Footer - Room Info */}
        {roomInfo && (
          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="font-mono">{roomInfo.roomId}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// Individual Participant Item
interface ParticipantItemProps {
  participant: RoomParticipant;
  isCurrentUser: boolean;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({ participant, isCurrentUser }) => {
  // Generate avatar color from name
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full ${getAvatarColor(participant.displayName)} flex items-center justify-center text-white font-medium text-sm`}>
        {getInitials(participant.displayName || 'U')}
      </div>

      {/* Name & Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">
            {participant.displayName || 'Unknown'}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-blue-400 bg-blue-400/20 px-2 py-0.5 rounded-full">
              You
            </span>
          )}
          {participant.isOwner && (
            <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded-full">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Mute/Video Status Indicators */}
      <div className="flex items-center gap-1">
        {participant.isMuted && (
          <div className="p-1.5 bg-red-500/20 rounded-full" title="Muted">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </div>
        )}
        {participant.isVideoEnabled === false && (
          <div className="p-1.5 bg-red-500/20 rounded-full" title="Camera off">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;
