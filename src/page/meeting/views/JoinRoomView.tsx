import React from 'react';
import {
  JoinForm,
  VideoPreviewPanel,
} from '@components/meeting';

export interface JoinRoomViewProps {
  roomId: string;
  userId: string;
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

export const JoinRoomView: React.FC<JoinRoomViewProps> = ({
  roomId,
  userId,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-7xl">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Branding & Features */}
          <div className="space-y-8">
            {/* Brand Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700">Video Conference Platform</span>
            </div>

            {/* Main Heading */}
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-4">
                Secure Video
                <br />
                <span className="text-blue-600">Conference</span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                Join high-quality video meetings with ease. Connect with your team, 
                collaborate in real-time, and share your screen with confidence.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-5">
              <FeatureItem
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
                title="HD Video Quality"
                description="Crystal-clear video and audio for seamless communication"
              />
              <FeatureItem
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
                title="End-to-End Security"
                description="Your meetings are encrypted and secure"
              />
              <FeatureItem
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
                title="Instant Screen Share"
                description="Share your screen with just one click"
              />
            </div>

            {/* Footer Note */}
            <p className="text-sm text-gray-500">
              By joining a meeting, you agree to our{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 underline">Privacy Policy</a>
            </p>
          </div>

          {/* Right Side - Join Form */}
          <div className="lg:pl-8">
            <JoinForm
              roomId={roomId}
              userId={userId}
              isJoining={isJoining}
              isMicEnabled={isMicEnabled}
              isVideoEnabled={isVideoEnabled}
              previewVideoRef={previewVideoRef}
              onRoomNameChange={onRoomNameChange}
              onUserNameChange={onUserNameChange}
              onMicToggle={onMicToggle}
              onVideoToggle={onVideoToggle}
              onJoinRoom={onJoinRoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Feature Item Component
interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

export default JoinRoomView;
