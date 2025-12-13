import React from 'react';
import { VideoTile } from '../components';

export interface ConsumerInfo {
  oderId: string;
  odisplayName: string;
}

interface VideoGridProps {
  consumers: ConsumerInfo[];
  pinnedIndex: number | null;
  onPinVideo: (index: number) => void;
  onUnpinVideo: () => void;
  isLoading?: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  consumers,
  pinnedIndex,
  onPinVideo,
  onUnpinVideo,
  isLoading = false,
}) => {
  // Calculate grid columns based on consumer count
  const getGridClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
        <p className="text-white/70 text-lg">Đang khởi tạo...</p>
      </div>
    );
  }

  // Show waiting state when no consumers
  if (consumers.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-white/70 text-lg">Waiting for members of Aladin Contract to join...</p>
        <p className="text-white/40 text-sm mt-2">Share room link to invite others</p>
      </div>
    );
  }

  // If a video is pinned, show pinned layout
  if (pinnedIndex !== null && consumers[pinnedIndex]) {
    const pinnedConsumer = consumers[pinnedIndex];
    const otherConsumers = consumers.filter((_, i) => i !== pinnedIndex);

    return (
      <div className="w-full h-full flex gap-3 p-2">
        {/* Pinned video - 75% width */}
        <div className="w-3/4 h-full animate-fade-in">
          <VideoTile
            videoId={`remote-video-${pinnedIndex}`}
            userId={`username-${pinnedIndex}`}
            size="equal"
            isPinned
            onUnpin={onUnpinVideo}
          />
        </div>

        {/* Other videos - 25% width, stacked vertically */}
        {otherConsumers.length > 0 && (
          <div className="w-1/4 h-full flex flex-col gap-2 overflow-y-auto">
            {otherConsumers.map((consumer, idx) => {
              const originalIndex = consumers.findIndex(c => c.oderId === consumer.oderId);
              return (
                <div 
                  key={consumer.oderId} 
                  className="aspect-video flex-shrink-0 animate-slide-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <VideoTile
                    videoId={`remote-video-${originalIndex}`}
                    userId={`username-${originalIndex}`}
                    size="equal"
                    showPinButton
                    onPin={() => onPinVideo(originalIndex)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Normal grid layout - all videos equal size
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className={`grid ${getGridClass(consumers.length)} gap-3 w-full max-w-6xl auto-rows-fr`}>
        {consumers.map((consumer, index) => (
          <div 
            key={consumer.oderId}
            className="aspect-video animate-scale-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <VideoTile
              videoId={`remote-video-${index}`}
              userId={`username-${index}`}
              size="equal"
              showPinButton
              onPin={() => onPinVideo(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;
