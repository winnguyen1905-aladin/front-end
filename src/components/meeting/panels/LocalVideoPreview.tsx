import React, { useState, useRef, useEffect } from 'react';
import { UserAvatar } from '../components';

interface LocalVideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isVideoEnabled: boolean;
}

export const LocalVideoPreview: React.FC<LocalVideoPreviewProps> = ({
  videoRef,
  isVideoEnabled,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set initial position (bottom-right)
    const updateInitialPosition = () => {
      const rightOffset = 24; // right-6 = 1.5rem = 24px
      const bottomOffset = 96; // bottom-24 = 6rem = 96px
      setPosition({
        x: window.innerWidth - 208 - rightOffset, // 208px is width (w-52)
        y: window.innerHeight - 160 - bottomOffset, // 160px is height (h-40)
      });
    };
    
    updateInitialPosition();
    window.addEventListener('resize', updateInitialPosition);
    return () => window.removeEventListener('resize', updateInitialPosition);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Constrain to viewport bounds
    const maxX = window.innerWidth - 208; // width of preview
    const maxY = window.innerHeight - 160; // height of preview
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div 
      ref={containerRef}
      className="fixed z-30"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <div 
        className="relative w-52 h-40 bg-[#3c4043] rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 group hover:border-blue-500 transition-all"
        onMouseDown={handleMouseDown}
      >
        <video
          ref={videoRef}
          id="local-video"
          className="w-full h-full object-cover pointer-events-none"
          muted
          autoPlay
          playsInline
        />
        
        {/* Avatar overlay when video is disabled */}
        {!isVideoEnabled && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 pointer-events-none">
            <UserAvatar size="lg" />
          </div>
        )}
        
        {/* Drag indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/20 rounded-full px-2 py-1 pointer-events-none">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-white/60 rounded-full"></div>
            <div className="w-1 h-1 bg-white/60 rounded-full"></div>
            <div className="w-1 h-1 bg-white/60 rounded-full"></div>
          </div>
        </div>
        
        <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded text-center pointer-events-none">
          {/* <span className="text-white text-xs font-medium">You</span> */}
        </div>
      </div>
    </div>
  );
};

export default LocalVideoPreview;
