// Base types
export type Language = 'auto' | 'vi' | 'en';
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
export type ResponseFormat = 'raw_text' | 'timestamped' | 'participant_separated' | 'detailed';

// Query parameters interface
export interface TranscriptQueryParams {
  language?: Language;
  model?: WhisperModel;
  format?: ResponseFormat;
  useCache?: boolean;
  forceRegenerate?: boolean;
  participantId?: string;
}

// Request body for POST /transcripts/generate
export interface GenerateTranscriptRequest {
  roomId: string;
  participantId?: string;
  language?: Language;
  model?: WhisperModel;
  format?: ResponseFormat;
  useCache?: boolean;
  forceRegenerate?: boolean;
}

// Upgrade transcript request params
export interface UpgradeTranscriptParams {
  fromModel?: WhisperModel;
  toModel?: WhisperModel;
  language?: Language;
  participantId?: string;
}

// Clear cache params
export interface ClearCacheParams {
  participantId?: string;
  language?: Language;
  model?: WhisperModel;
  format?: ResponseFormat;
}

// Response data structures
export interface TimestampedSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

// Actual API response format for timestampedText
export interface TimestampedTextItem {
  timestamp: string; // e.g. "00:00"
  text: string;
  participant: string;
}

export interface WhisperSegment {
  segmentNumber: number;
  fileName: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  whisperSegments: any[]; // Can be more specific if needed
}

export interface ParticipantTranscript {
  participantId: string;
  displayName: string;
  text?: string;
  segments?: WhisperSegment[];
  totalDuration: number;
  confidence: number;
}

export interface DetailedTranscript {
  participants: ParticipantTranscript[];
  totalDuration: number;
  averageConfidence: number;
  processingTime: number;
}

// Main response interface
export interface TranscriptResponseDto {
  roomId: string;
  format: ResponseFormat;
  language: Language;
  model: WhisperModel;
  generatedAt: string; // ISO timestamp
  cached: boolean; // Whether response came from cache
  processingTime?: number; // Processing time in milliseconds (detailed format)
  
  // Format-specific data
  rawText?: string;
  timestamped?: TimestampedSegment[];
  timestampedText?: TimestampedTextItem[]; // Actual API format
  participants?: ParticipantTranscript[];
  detailed?: DetailedTranscript;
}

// Health check response
export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  endpoints: string[];
  features: {
    'Multiple Models': WhisperModel[];
    'Languages': Language[];
    'Response Formats': ResponseFormat[];
    'Caching': string;
    'Force Regeneration': string;
  };
}

// Upgrade transcript response
export interface UpgradeTranscriptResponse {
  upgraded: boolean;
  oldModel: WhisperModel;
  newModel: WhisperModel;
  transcript: TranscriptResponseDto;
}

// Clear cache response
export interface ClearCacheResponse {
  cleared: boolean;
  filesRemoved: number;
}

// Error response structure
export interface TranscriptErrorResponse {
  message: string;
  error: string;
  statusCode: number;
}