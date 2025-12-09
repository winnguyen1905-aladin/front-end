import React from 'react';
import { VideoTile } from '../components';

interface VideoGridProps {
  pinnedProducerId: string | null;
  onPinVideo: (index: number) => void;
  thumbnailCount?: number;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  pinnedProducerId,
  onPinVideo,
  thumbnailCount = 4,
}) => {
  return (
    <div className="w-full max-w-7xl h-full">
      {/* Dominant Speaker - Large Video */}
      <div className="h-[calc(100%-120px)] mb-4">
        <VideoTile
          videoId="remote-video-0"
          usernameId="username-0"
          isPinned={!!pinnedProducerId}
          onUnpin={() => onPinVideo(0)}
          size="main"
        />
      </div>

      {/* Thumbnail Strip */}
      <ThumbnailStrip
        count={thumbnailCount}
        onPinVideo={onPinVideo}
      />
    </div>
  );
};

// Sub-component for thumbnail strip
interface ThumbnailStripProps {
  count: number;
  onPinVideo: (index: number) => void;
}

const ThumbnailStrip: React.FC<ThumbnailStripProps> = ({ count, onPinVideo }) => (
  <div className="h-[110px] flex gap-3 overflow-x-auto">
    {Array.from({ length: count }, (_, i) => i + 1).map((index) => (
      <VideoTile
        key={index}
        videoId={`remote-video-${index}`}
        usernameId={`username-${index}`}
        size="thumbnail"
        showPinButton
        onPin={() => onPinVideo(index)}
      />
    ))}
  </div>
);

export default VideoGrid;
