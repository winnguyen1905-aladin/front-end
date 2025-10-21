import React from 'react';

interface JoinRoomProps {
  roomName: string;
  userName: string;
  isJoining: boolean;
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onRoomNameChange: (name: string) => void;
  onUserNameChange: (name: string) => void;
  onMicToggle: () => void;
  onVideoToggle: () => void;
  onJoinRoom: () => void;
}

export const JoinRoom: React.FC<JoinRoomProps> = ({
  roomName,
  userName,
  isJoining,
  isMicEnabled,
  isVideoEnabled,
  previewVideoRef,
  onRoomNameChange,
  onUserNameChange,
  onMicToggle,
  onVideoToggle,
  onJoinRoom,
}) => {
  return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-normal text-white mb-2">
            Ready to join?
          </h1>
          <p className="text-gray-400 text-sm">
            Check your audio and video before joining the meeting
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Side - Video Preview */}
          <div className="lg:col-span-3">
            <div className="relative bg-[#3c4043] rounded-3xl overflow-hidden aspect-video shadow-2xl">
              {/* Video Preview */}
              {isVideoEnabled ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                  <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl font-semibold text-white">
                      {userName.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <p className="text-gray-300 text-lg">{userName || 'You'}</p>
                </div>
              )}

              {/* User Name Overlay */}
              <div className="absolute bottom-6 left-6 bg-black bg-opacity-60 px-4 py-2 rounded-lg">
                <p className="text-white text-sm font-medium">{userName || 'You'}</p>
              </div>

              {/* Controls Overlay */}
              <div className="absolute bottom-6 right-6 flex gap-3">
                {/* Microphone Button */}
                <button
                  onClick={onMicToggle}
                  disabled={isJoining}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMicEnabled 
                      ? 'bg-[#3c4043] hover:bg-[#4d5053] text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isMicEnabled ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Camera Button */}
                <button
                  onClick={onVideoToggle}
                  disabled={isJoining}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isVideoEnabled 
                      ? 'bg-[#3c4043] hover:bg-[#4d5053] text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13.455V6.545a2 2 0 00-3-1.732V6a2 2 0 01-2 2h-1.586l-5-5H13a2 2 0 012 2v.268l2-1.333a1 1 0 011.447.894v6.878a1 1 0 01-.553.894l-2 1A1 1 0 0114 12v-1.586l-2-2V6a2 2 0 00-2-2H8.414L3.707 2.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Meeting Info Form */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Room Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Meeting room
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => onRoomNameChange(e.target.value)}
                  disabled={isJoining}
                  placeholder="Enter room code"
                  className="w-full px-4 py-3 bg-[#3c4043] border border-[#5f6368] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* User Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => onUserNameChange(e.target.value)}
                  disabled={isJoining}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-[#3c4043] border border-[#5f6368] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Media Status Indicators */}
              <div className="bg-[#3c4043] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isMicEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-300">
                      Microphone {isMicEnabled ? 'on' : 'off'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-300">
                      Camera {isVideoEnabled ? 'on' : 'off'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Join Button */}
              <button
                onClick={onJoinRoom}
                disabled={isJoining || !userName.trim() || !roomName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  'Join now'
                )}
              </button>

              {/* Back Link */}
              <div className="text-center">
                <a 
                  href="/" 
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  ← Return to home
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
