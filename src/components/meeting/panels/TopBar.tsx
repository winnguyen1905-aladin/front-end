import React from 'react';

interface TopBarProps {
  isVisible: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ isVisible }) => {
  return (
    <div 
      className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">Meeting in progress</span>
        </div>
        <div className="text-white text-sm">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
