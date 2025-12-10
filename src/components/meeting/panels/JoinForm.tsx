import React, { useState, useEffect, useRef } from 'react';
import { StatusIndicator, UserAvatar, MediaControlButton } from '../components';
import { SpinnerIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '../icons';

interface JoinFormProps {
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

export const JoinForm: React.FC<JoinFormProps> = ({
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
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const previewStreamRef = useRef<MediaStream | null>(null);

  const canProceedStep1 = roomId.trim() !== '';
  const canProceedStep2 = userId.trim() !== '';
  const canJoin = canProceedStep1 && canProceedStep2;

  // Initialize media preview when reaching step 3
  useEffect(() => {
    if (currentStep === 3 && previewVideoRef.current) {
      console.log('[JoinForm] Initializing media preview for step 3');
      
      // Request both audio and video permissions
      navigator.mediaDevices.getUserMedia({ 
        video: isVideoEnabled, 
        audio: true 
      })
        .then((stream) => {
          console.log('[JoinForm] Got media stream:', stream.getTracks().length);
          previewStreamRef.current = stream;
          
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
            previewVideoRef.current.play().catch(err => {
              console.error('[JoinForm] Failed to play preview video:', err);
            });
          }
        })
        .catch((err) => {
          console.error('[JoinForm] Failed to get media preview:', err);
          // Still allow joining but show error state
        });
    }

    // Cleanup when leaving step 3 or component unmounts
    return () => {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }
    };
  }, [currentStep, isVideoEnabled, previewVideoRef]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-blue-600 tracking-wider uppercase">
            STEP {currentStep} OF {totalSteps}
          </span>
          {/* Progress Bar */}
          <div className="flex-1 ml-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          {currentStep === 1 && 'Enter meeting details'}
          {currentStep === 2 && 'Setup your profile'}
          {currentStep === 3 && 'Review and join'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {currentStep === 1 && 'Provide the room code to join the meeting'}
          {currentStep === 2 && 'Tell us your name and preferences'}
          {currentStep === 3 && 'Check your settings before joining'}
        </p>
      </div>

      {/* Step 1: Room Details */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <FormInput
            label="Meeting Room Code"
            value={roomId}
            onChange={onRoomNameChange}
            disabled={isJoining}
            placeholder="Enter room code"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          
          <button
            onClick={() => setCurrentStep(2)}
            disabled={!canProceedStep1}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none"
          >
            Continue →
          </button>

          <div className="text-center">
            <a 
              href="/" 
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to home
            </a>
          </div>
        </div>
      )}

      {/* Step 2: User Profile */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <FormInput
            label="Your Name"
            value={userId}
            onChange={onUserNameChange}
            disabled={isJoining}
            placeholder="Enter your name"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-xl transition-all"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={!canProceedStep2}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review and Join */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Success Indicator */}
          <div className="flex items-center justify-center py-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Connection Info Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
            <p className="text-xs font-semibold text-blue-600 mb-3">MEETING DETAILS</p>
            
            <div className="space-y-3">
              <InfoRow label="Room" value={roomId} />
              <InfoRow label="Name" value={userId} />
              <InfoRow 
                label="Audio" 
                value={
                  <span className={isMicEnabled ? 'text-green-600' : 'text-red-600'}>
                    {isMicEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                } 
              />
              <InfoRow 
                label="Video" 
                value={
                  <span className={isVideoEnabled ? 'text-green-600' : 'text-red-600'}>
                    {isVideoEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                } 
              />
            </div>
          </div>

          {/* Video Preview */}
          <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
            {isVideoEnabled ? (
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                <UserAvatar name={userId} size="lg" showName />
              </div>
            )}

            {/* Media Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
              <MediaControlButton
                onClick={onMicToggle}
                disabled={isJoining}
                isActive={isMicEnabled}
                activeIcon={<MicIcon className="w-5 h-5" />}
                inactiveIcon={<MicOffIcon className="w-5 h-5" />}
                title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                size="md"
              />
              <MediaControlButton
                onClick={onVideoToggle}
                disabled={isJoining}
                isActive={isVideoEnabled}
                activeIcon={<VideoIcon className="w-5 h-5" />}
                inactiveIcon={<VideoOffIcon className="w-5 h-5" />}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                size="md"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onJoinRoom}
              disabled={isJoining || !canJoin}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <SpinnerIcon className="h-5 w-5" />
                  Joining meeting...
                </>
              ) : (
                <>
                  Join meeting
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            <button
              onClick={() => setCurrentStep(2)}
              disabled={isJoining}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all border border-gray-300"
            >
              Back to profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for form inputs
interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  icon,
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          {icon}
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full ${icon ? 'pl-12' : 'pl-4'} pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50`}
      />
    </div>
  </div>
);

// Sub-component for info rows
interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <span className="text-sm font-semibold text-gray-900">{value}</span>
  </div>
);

export default JoinForm;
