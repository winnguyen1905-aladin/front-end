import React from 'react';

interface StatusIndicatorProps {
  isActive: boolean;
  label: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isActive, label }) => {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-gray-300">
        {label} {isActive ? 'on' : 'off'}
      </span>
    </div>
  );
};

export default StatusIndicator;
