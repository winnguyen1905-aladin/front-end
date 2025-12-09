import React, { useState } from 'react';

interface ActiveCallProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteMediaReady: boolean;
  isStreamEnabled: boolean;
  isStreamSent: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  pinnedProducerId: string | null;
  onEnableFeed: () => void;
  onSendFeed: () => void;
  onMuteAudio: () => void;
  onVideoToggle: () => void;
  onScreenShare: () => void;
  onHangUp: () => void;
  onPinVideo: (videoIndex: number) => void;
}

export const ActiveCall: React.FC<ActiveCallProps> = ({
  localVideoRef,
  isRemoteMediaReady,
  isStreamEnabled,
  isStreamSent,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  pinnedProducerId,
  onEnableFeed,
  onSendFeed,
  onMuteAudio,
  onVideoToggle,
  onScreenShare,
  onHangUp,
  onPinVideo,
}) => {
  const [showControls, setShowControls] = useState(true);

  return (
    <div 
      className="min-h-screen bg-[#202124] relative overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Top Bar - Meeting Info */}
      <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Meeting in progress</span>
          </div>
          <div className="text-white text-sm">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Video Grid Container */}
      <div className="h-screen flex items-center justify-center p-4 pt-20 pb-32">
        {/* Main Video Grid */}
        <div className="w-full max-w-7xl h-full">
          {/* Dominant Speaker - Large Video */}
          <div className="h-[calc(100%-120px)] mb-4">
            <div className="relative h-full bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl group">
              <video 
                id="remote-video-0" 
                className="w-full h-full object-cover remote-video" 
                autoPlay 
                playsInline 
              />
              <div id="username-0" className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <span className="text-white text-sm font-medium"></span>
              </div>
              
              {/* Pin Indicator with Unpin Button */}
              {pinnedProducerId && (
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="bg-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                    </svg>
                    <span className="text-white text-xs font-medium">Pinned</span>
                  </div>
                  <button
                    onClick={() => onPinVideo(0)}
                    className="bg-red-600 hover:bg-red-700 p-1.5 rounded-lg transition-colors"
                    title="Unpin video"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Speaking Indicator */}
              <div className="absolute inset-0 pointer-events-none ring-4 ring-green-500/0 transition-all duration-200" id="speaker-indicator-0"></div>
            </div>
          </div>

          {/* Thumbnail Strip - Other Participants */}
          <div className="h-[110px] flex gap-3 overflow-x-auto">
            {[1, 2, 3, 4].map((index) => (
              <div 
                key={index}
                className="relative flex-shrink-0 w-[180px] h-full bg-[#3c4043] rounded-xl overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all group cursor-pointer"
                onClick={() => onPinVideo(index)}
              >
                <video 
                  id={`remote-video-${index}`}
                  className="w-full h-full object-cover remote-video" 
                  autoPlay 
                  playsInline 
                />
                <div id={`username-${index}`} className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-center">
                  <span className="text-white text-xs font-medium truncate block"></span>
                </div>
                
                {/* Pin Button - Shows on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinVideo(index);
                    }}
                    className="bg-black/80 hover:bg-blue-600 p-2 rounded-lg transition-colors"
                    title="Pin to main screen"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Local Video - Picture in Picture */}
      <div className="fixed bottom-24 right-6 z-30">
        <div className="relative w-52 h-40 bg-[#3c4043] rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 group hover:border-blue-500 transition-all">
          {/* Always render video element to avoid unmounting issues */}
          <video
            ref={localVideoRef}
            id="local-video"
            className="w-full h-full object-cover"
            muted
            autoPlay
            playsInline
          />
          
          {/* Show avatar overlay when video is disabled */}
          {!isVideoEnabled && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-center">
            <span className="text-white text-xs font-medium">You</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar - Google Meet Style */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-[#202124] border-t border-gray-700">
          <div className="max-w-4xl mx-auto px-6 py-4">
            {/* Initial Setup Buttons (if not fully ready) */}
            {(!isStreamEnabled || !isStreamSent) && (
              <div className="flex justify-center gap-3 mb-4 pb-4 border-b border-gray-700">
                {!isStreamEnabled && (
                  <button
                    onClick={onEnableFeed}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg"
                  >
                    Enable Camera & Mic
                  </button>
                )}
                {isStreamEnabled && !isStreamSent && (
                  <button
                    onClick={onSendFeed}
                    disabled={!isRemoteMediaReady}
                    className={`px-6 py-2 text-white text-sm font-medium rounded-lg transition-all shadow-lg ${
                      isRemoteMediaReady
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isRemoteMediaReady ? 'Start Broadcasting' : 'Connecting to room...'}
                  </button>
                )}
              </div>
            )}

            {/* Main Controls */}
            <div className="flex items-center justify-between">
              {/* Left - Meeting Info */}
              <div className="flex-1 flex items-center gap-2">
                <div className="text-gray-400 text-sm hidden md:block">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Center - Primary Controls */}
              <div className="flex items-center gap-3">
                {/* Microphone */}
                <button
                  onClick={onMuteAudio}
                  disabled={!isStreamSent}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                    isMuted 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-[#3c4043] hover:bg-[#4d5053] text-white'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Camera */}
                <button
                  onClick={onVideoToggle}
                  disabled={!isStreamSent}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                    !isVideoEnabled 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-[#3c4043] hover:bg-[#4d5053] text-white'
                  }`}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13.455V6.545a2 2 0 00-3-1.732V6a2 2 0 01-2 2h-1.586l-5-5H13a2 2 0 012 2v.268l2-1.333a1 1 0 011.447.894v6.878a1 1 0 01-.553.894l-2 1A1 1 0 0114 12v-1.586l-2-2V6a2 2 0 00-2-2H8.414L3.707 2.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Screen Share */}
                <button
                  onClick={onScreenShare}
                  disabled={!isStreamSent}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                    isScreenSharing 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-[#3c4043] hover:bg-[#4d5053] text-white'
                  }`}
                  title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Hang Up */}
                <button
                  onClick={onHangUp}
                  disabled={!isStreamSent}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  title="Leave call"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </button>
              </div>

              {/* Right - More Options */}
              <div className="flex-1 flex justify-end">
                <button
                  className="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4d5053] text-white flex items-center justify-center transition-all"
                  title="More options"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveCall;
