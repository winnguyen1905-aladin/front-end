import React from 'react';
import { UserIcon } from '../icons';

interface UserAvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const textSizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  size = 'lg',
  showName = false,
}) => {
  const initial = name?.charAt(0).toUpperCase() || '';

  return (
    <div className="flex flex-col items-center">
      <div className={`${sizeClasses[size]} bg-blue-600 rounded-full flex items-center justify-center`}>
        {initial ? (
          <span className={`${textSizes[size]} font-semibold text-white`}>
            {initial}
          </span>
        ) : (
          <UserIcon className={iconSizes[size]} />
        )}
      </div>
      {showName && name && (
        <p className="text-gray-300 text-lg mt-4">{name}</p>
      )}
    </div>
  );
};

export default UserAvatar;
