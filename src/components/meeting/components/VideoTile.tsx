import React from 'react';
import { PinIcon } from '../icons';

interface VideoTileProps {
  videoId: string;
  userId?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  isPinned?: boolean;
  showPinButton?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  size?: 'thumbnail' | 'main' | 'pip' | 'equal';
  muted?: boolean;
  label?: string;
  children?: React.ReactNode;
}

const sizeClasses = {
  thumbnail: 'w-[180px] h-[110px]',
  main: 'h-full',
  pip: 'w-52 h-40',
  equal: 'w-full h-full',
};

export const VideoTile: React.FC<VideoTileProps> = ({
  videoId,
  userId,
  videoRef,
  isPinned = false,
  showPinButton = false,
  onPin,
  onUnpin,
  size = 'main',
  muted = false,
  label,
  children,
}) => {
  const containerClasses = {
    thumbnail: 'relative flex-shrink-0 bg-[#3c4043] rounded-xl overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all group cursor-pointer',
    main: 'relative h-full bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl group',
    pip: 'relative bg-[#3c4043] rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 group hover:border-blue-500 transition-all',
    equal: 'relative w-full h-full bg-[#3c4043] rounded-xl overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all group',
  };

  return (
    <div 
      className={`${containerClasses[size]} ${sizeClasses[size]}`}
      onClick={size === 'thumbnail' && onPin ? onPin : undefined}
    >
      <video
        ref={videoRef}
        id={videoId}
        className="w-full h-full object-contain remote-video"
        muted={muted}
        autoPlay
        playsInline
      />
      
      {/* Username Label - Dynamic content set via innerHTML by StreamContext */}
      <div 
        id={userId}
        className={`absolute ${size === 'thumbnail' ? 'bottom-2 left-2 right-2' : 'bottom-4 left-4'} bg-black/60 backdrop-blur-sm ${size === 'thumbnail' ? 'px-2 py-1' : 'px-3 py-1.5'} ${size === 'thumbnail' ? 'rounded' : 'rounded-lg'} ${size === 'thumbnail' ? 'text-center' : ''} text-white ${size === 'thumbnail' ? 'text-xs' : 'text-sm'} font-medium ${size === 'thumbnail' ? 'truncate' : ''} empty:hidden`}
      >
        {label}
      </div>
      
      {/* Pin Indicator */}
      {isPinned && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <PinIcon className="w-4 h-4 text-white" />
            <span className="text-white text-xs font-medium">Pinned</span>
          </div>
          {onUnpin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnpin();
              }}
              className="bg-red-600 hover:bg-red-700 p-1.5 rounded-lg transition-colors"
              title="Unpin video"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      {/* Pin Button on Hover (for thumbnails) */}
      {showPinButton && !isPinned && onPin && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="bg-black/80 hover:bg-blue-600 p-2 rounded-lg transition-colors"
            title="Pin to main screen"
          >
            <PinIcon className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
      
      {/* Speaking Indicator */}
      <div className="absolute inset-0 pointer-events-none ring-4 ring-green-500/0 transition-all duration-200" id={`speaker-indicator-${videoId}`}></div>
      
      {children}
    </div>
  );
};

export default VideoTile;
