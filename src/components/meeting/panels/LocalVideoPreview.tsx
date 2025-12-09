import React from 'react';
import { UserAvatar } from '../components';

interface LocalVideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isVideoEnabled: boolean;
}

export const LocalVideoPreview: React.FC<LocalVideoPreviewProps> = ({
  videoRef,
  isVideoEnabled,
}) => {
  return (
    <div className="fixed bottom-24 right-6 z-30">
      <div className="relative w-52 h-40 bg-[#3c4043] rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 group hover:border-blue-500 transition-all">
        <video
          ref={videoRef}
          id="local-video"
          className="w-full h-full object-cover"
          muted
          autoPlay
          playsInline
        />
        
        {/* Avatar overlay when video is disabled */}
        {!isVideoEnabled && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            <UserAvatar size="lg" />
          </div>
        )}
        
        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-center">
          <span className="text-white text-xs font-medium">You</span>
        </div>
      </div>
    </div>
  );
};

export default LocalVideoPreview;
