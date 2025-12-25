import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import transcriptService from '../../socket/transcriptService';
import {
  TranscriptResponseDto,
  Language,
  WhisperModel,
  ResponseFormat,
  TimestampedSegment,
  TimestampedTextItem,
  ParticipantTranscript
} from '../../types/transcript.types';

interface TranscriptFormData {
  roomId: string;
  language: Language;
  model: WhisperModel;
  format: ResponseFormat;
  useCache: boolean;
  forceRegenerate: boolean;
  participantId?: string;
}

export const TranscriptPage: React.FC = () => {
  const [formData, setFormData] = useState<TranscriptFormData>({
    roomId: '',
    language: 'auto',
    model: 'base',
    format: 'detailed',
    useCache: true,
    forceRegenerate: false,
    participantId: ''
  });

  const [transcript, setTranscript] = useState<TranscriptResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roomId.trim()) {
      setError('Room ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const params = {
        language: formData.language,
        model: formData.model,
        format: formData.format,
        useCache: formData.useCache,
        forceRegenerate: formData.forceRegenerate,
        ...(formData.participantId && { participantId: formData.participantId })
      };

      const result = await transcriptService.getRoomTranscript(formData.roomId, params);
      setTranscript(result);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch transcript');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTranscriptContent = () => {
    if (!transcript) return null;

    let segments: Array<{ time: string; speaker: string; text: string }> = [];

    // Handle the actual timestampedText format from API
    if (transcript.format === 'timestamped' && transcript.timestampedText) {
      segments = transcript.timestampedText.map((item: TimestampedTextItem) => ({
        time: item.timestamp, // Already in "MM:SS" format
        speaker: item.participant,
        text: item.text
      }));
    } else if (transcript.format === 'timestamped' && transcript.timestamped) {
      // Fallback for the documented format (if it exists)
      segments = transcript.timestamped.map((segment: TimestampedSegment, index: number) => ({
        time: formatTime(segment.start),
        speaker: String.fromCharCode(65 + (index % 26)), // A, B, C, etc.
        text: segment.text
      }));
    } else if (transcript.format === 'participant_separated' && transcript.participants) {
      transcript.participants.forEach((participant: ParticipantTranscript) => {
        if (participant.segments) {
          participant.segments.forEach(segment => {
            segments.push({
              time: formatTime(segment.start),
              speaker: participant.displayName || participant.participantId,
              text: segment.text
            });
          });
        } else if (participant.text) {
          segments.push({
            time: formatTime(0),
            speaker: participant.displayName || participant.participantId,
            text: participant.text
          });
        }
      });
    } else if (transcript.format === 'detailed' && transcript.detailed) {
      transcript.detailed.participants.forEach((participant: ParticipantTranscript) => {
        if (participant.segments) {
          participant.segments.forEach(segment => {
            segments.push({
              time: formatTime(segment.start),
              speaker: participant.displayName || participant.participantId,
              text: segment.text
            });
          });
        }
      });
    } else if (transcript.format === 'raw_text' && transcript.rawText) {
      segments = [{
        time: formatTime(0),
        speaker: 'Unknown',
        text: transcript.rawText
      }];
    }

    // Sort by time (convert back to number for sorting, then use original time string)
    segments.sort((a, b) => {
      const timeA = a.time.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
      const timeB = b.time.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
      return timeA - timeB;
    });

    return (
      <div className="space-y-3">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-blue-600 font-mono text-sm min-w-[50px]">
              {segment.time}
            </span>
            <span className="text-purple-600 font-semibold min-w-[30px]">
              {segment.speaker}:
            </span>
            <span className="text-gray-800 flex-1">
              {segment.text}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Transcript Viewer
          </h1>
          <p className="text-gray-600">
            Get and view transcripts for your meetings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Transcript Settings
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Room ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room ID *
                  </label>
                  <input
                    type="text"
                    name="roomId"
                    value={formData.roomId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter room ID"
                    required
                  />
                </div>

                {/* Participant ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Participant ID (Optional)
                  </label>
                  <input
                    type="text"
                    name="participantId"
                    value={formData.participantId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave empty for all participants"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="vi">Vietnamese</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Whisper Model
                  </label>
                  <select
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="tiny">Tiny (Fast)</option>
                    <option value="base">Base (Recommended)</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="large-v2">Large v2</option>
                    <option value="large-v3">Large v3 (Best Quality)</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Response Format
                  </label>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="detailed">Detailed (Recommended)</option>
                    <option value="timestamped">Timestamped</option>
                    <option value="participant_separated">Participant Separated</option>
                    <option value="raw_text">Raw Text</option>
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="useCache"
                      checked={formData.useCache}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Use cache</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="forceRegenerate"
                      checked={formData.forceRegenerate}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Force regenerate</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? 'Loading...' : 'Get Transcript'}
                </button>
              </form>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Transcript Info */}
              {transcript && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Transcript Info</h3>
                  <div className="text-xs text-green-700 space-y-1">
                    <p><span className="font-medium">Room:</span> {transcript.roomId}</p>
                    <p><span className="font-medium">Language:</span> {transcript.language}</p>
                    <p><span className="font-medium">Model:</span> {transcript.model}</p>
                    <p><span className="font-medium">Format:</span> {transcript.format}</p>
                    <p><span className="font-medium">Cached:</span> {transcript.cached ? 'Yes' : 'No'}</p>
                    {transcript.processingTime && (
                      <p><span className="font-medium">Processing Time:</span> {transcript.processingTime}ms</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transcript Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Transcript Content
              </h2>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading transcript...</span>
                </div>
              ) : transcript ? (
                <div className="max-h-96 overflow-y-auto">
                  {renderTranscriptContent()}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No transcript loaded</p>
                  <p className="text-sm">Enter a room ID and click "Get Transcript" to view the transcript</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
