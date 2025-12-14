import React, { useState, useRef, useEffect } from 'react';
import { MediaControlButton } from '../components';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  HangUpIcon,
  BackgroundRemoveIcon,
  ImageIcon,
  UploadIcon,
  CheckIcon,
} from '../icons';
import { SegmentationMode, FaceEnhancementConfig } from '@context/StreamContext';

// Default background images (using Unsplash for high-quality free images)
const DEFAULT_BACKGROUNDS = [
  {
    id: 'none',
    name: 'No Background',
    thumbnail: null,
    url: null,
  },
  {
    id: 'blur',
    name: 'Blur',
    thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60"><rect fill="%23667788" width="80" height="60"/><text x="40" y="35" text-anchor="middle" fill="white" font-size="12">Blur</text></svg>',
    url: 'blur',
  },
  {
    id: 'office',
    name: 'Modern Office',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
  },
  {
    id: 'nature',
    name: 'Nature',
    thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
  },
  {
    id: 'beach',
    name: 'Beach',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
  },
  {
    id: 'mountain',
    name: 'Mountains',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop',
  },
  {
    id: 'city',
    name: 'City Skyline',
    thumbnail: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&h=1080&fit=crop',
  },
  {
    id: 'library',
    name: 'Library',
    thumbnail: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=160&h=120&fit=crop',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1920&h=1080&fit=crop',
  },
];

interface ControlBarProps {
  isVisible: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSegmentationEnabled?: boolean;
  segmentationMode?: SegmentationMode;
  faceEnhancement?: FaceEnhancementConfig;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
  onToggleSegmentation?: () => void;
  onSetVirtualBackground?: (bg: string | File) => Promise<void>;
  onSetSegmentationMode?: (mode: SegmentationMode) => void;
  onSetFaceEnhancement?: (config: Partial<FaceEnhancementConfig>) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isVisible,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isSegmentationEnabled = false,
  segmentationMode = 'none',
  faceEnhancement,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
  onToggleSegmentation,
  onSetVirtualBackground,
  onSetSegmentationMode,
  onSetFaceEnhancement,
}) => {
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string>('none');
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowBackgroundPanel(false);
      }
    };
    if (showBackgroundPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBackgroundPanel]);

  const handleBackgroundSelect = async (bg: typeof DEFAULT_BACKGROUNDS[0]) => {
    setIsLoading(true);
    setSelectedBackground(bg.id);
    
    try {
      if (bg.id === 'none') {
        onSetSegmentationMode?.('none');
      } else if (bg.id === 'blur') {
        onSetSegmentationMode?.('blur');
      } else if (bg.url) {
        await onSetVirtualBackground?.(bg.url);
      }
    } catch (error) {
      console.error('Failed to set background:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setIsLoading(true);
    try {
      // Create preview URL for thumbnail
      const previewUrl = URL.createObjectURL(file);
      setCustomBackground(previewUrl);
      setSelectedBackground('custom');
      
      // Upload to processor
      await onSetVirtualBackground?.(file);
    } catch (error) {
      console.error('Failed to upload background:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-[#202124]/95 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-3">
            {/* Mic Toggle */}
            <MediaControlButton
              onClick={onMuteAudio}
              isActive={!isMuted}
              activeIcon={<MicIcon />}
              inactiveIcon={<MicOffIcon />}
              title={isMuted ? 'Unmute' : 'Mute'}
            />

            {/* Video Toggle */}
            <MediaControlButton
              onClick={onVideoToggle}
              isActive={isVideoEnabled}
              activeIcon={<VideoIcon />}
              inactiveIcon={<VideoOffIcon />}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            />

            {/* Screen Share */}
            <MediaControlButton
              onClick={onScreenShare}
              isActive={isScreenSharing}
              activeIcon={<ScreenShareIcon />}
              inactiveIcon={<ScreenShareIcon />}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            />

            {/* Background Settings */}
            {onSetVirtualBackground && (
              <div className="relative" ref={panelRef}>
                <MediaControlButton
                  onClick={() => setShowBackgroundPanel(!showBackgroundPanel)}
                  isActive={showBackgroundPanel || segmentationMode !== 'none'}
                  activeIcon={<ImageIcon />}
                  inactiveIcon={<ImageIcon />}
                  title="Background settings"
                />
                
                {/* Background Panel Popup */}
                {showBackgroundPanel && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[400px] bg-[#2d2e30] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/10">
                      <h3 className="text-white font-medium text-sm">Background Effects</h3>
                    </div>
                    
                    {/* Face Enhancement Toggle */}
                    {onSetFaceEnhancement && faceEnhancement && (
                      <div className="px-4 py-3 border-b border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm">Face Enhancement</span>
                          <button
                            onClick={() => onSetFaceEnhancement({ enabled: !faceEnhancement.enabled })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              faceEnhancement.enabled ? 'bg-blue-500' : 'bg-gray-600'
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                faceEnhancement.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        
                        {/* Enhancement Sliders */}
                        {faceEnhancement.enabled && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-white/60 text-xs w-16">Smooth</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={faceEnhancement.smoothing}
                                onChange={(e) => onSetFaceEnhancement({ smoothing: parseInt(e.target.value) })}
                                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-white/60 text-xs w-8">{faceEnhancement.smoothing}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-white/60 text-xs w-16">Brighten</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={faceEnhancement.whitening}
                                onChange={(e) => onSetFaceEnhancement({ whitening: parseInt(e.target.value) })}
                                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-white/60 text-xs w-8">{faceEnhancement.whitening}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-white/60 text-xs w-16">Sharp</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={faceEnhancement.sharpening}
                                onChange={(e) => onSetFaceEnhancement({ sharpening: parseInt(e.target.value) })}
                                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-white/60 text-xs w-8">{faceEnhancement.sharpening}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Background Grid */}
                    <div className="p-4">
                      <div className="grid grid-cols-4 gap-2">
                        {/* Upload Button */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          className="aspect-[4/3] rounded-lg border-2 border-dashed border-white/30 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors group"
                        >
                          <UploadIcon className="w-5 h-5 text-white/60 group-hover:text-blue-400" />
                          <span className="text-[10px] text-white/60 group-hover:text-blue-400">Upload</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        
                        {/* Custom Uploaded Background */}
                        {customBackground && (
                          <button
                            onClick={() => {
                              setSelectedBackground('custom');
                              onSetVirtualBackground?.(customBackground);
                            }}
                            disabled={isLoading}
                            className={`aspect-[4/3] rounded-lg overflow-hidden relative border-2 transition-all ${
                              selectedBackground === 'custom' 
                                ? 'border-blue-500 ring-2 ring-blue-500/50' 
                                : 'border-transparent hover:border-white/30'
                            }`}
                          >
                            <img 
                              src={customBackground} 
                              alt="Custom" 
                              className="w-full h-full object-cover"
                            />
                            {selectedBackground === 'custom' && (
                              <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                                <CheckIcon className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        )}
                        
                        {/* Default Backgrounds */}
                        {DEFAULT_BACKGROUNDS.map((bg) => (
                          <button
                            key={bg.id}
                            onClick={() => handleBackgroundSelect(bg)}
                            disabled={isLoading}
                            className={`aspect-[4/3] rounded-lg overflow-hidden relative border-2 transition-all ${
                              selectedBackground === bg.id 
                                ? 'border-blue-500 ring-2 ring-blue-500/50' 
                                : 'border-transparent hover:border-white/30'
                            }`}
                          >
                            {bg.thumbnail ? (
                              <img 
                                src={bg.thumbnail} 
                                alt={bg.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                <span className="text-[10px] text-white/60">None</span>
                              </div>
                            )}
                            {selectedBackground === bg.id && (
                              <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                                <CheckIcon className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <span className="text-[9px] text-white/80 truncate block">{bg.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Loading Overlay */}
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hang Up */}
            <MediaControlButton
              // onClick={onHangUp}
              onClick={() => window.location.href = "/"}
              isActive={false}
              activeIcon={<HangUpIcon />}
              inactiveIcon={<HangUpIcon />}
              title="Leave call"
              variant="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
