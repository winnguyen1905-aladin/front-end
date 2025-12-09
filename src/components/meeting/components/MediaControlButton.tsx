import React from 'react';

interface MediaControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger';
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

export const MediaControlButton: React.FC<MediaControlButtonProps> = ({
  onClick,
  disabled = false,
  isActive = true,
  activeIcon,
  inactiveIcon,
  title,
  size = 'lg',
  variant = 'default',
}) => {
  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100`;
  
  const getVariantClasses = () => {
    if (variant === 'danger') {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    
    if (!isActive) {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    
    return 'bg-[#3c4043] hover:bg-[#4d5053] text-white';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${getVariantClasses()}`}
      title={title}
    >
      {isActive ? activeIcon : inactiveIcon}
    </button>
  );
};

export default MediaControlButton;
