import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  TranscriptQueryParams,
  GenerateTranscriptRequest,
  UpgradeTranscriptParams,
  ClearCacheParams,
  TranscriptResponseDto,
  HealthCheckResponse,
  UpgradeTranscriptResponse,
  ClearCacheResponse,
  Language,
  WhisperModel,
  ResponseFormat
} from '../types/transcript.types';

class TranscriptService {
  private api: AxiosInstance;
  private baseURL = import.meta.env.VITE_SOCKET_URL + '/transcripts';

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // 1. Health Check
  async healthCheck(): Promise<HealthCheckResponse> {
    const response: AxiosResponse<HealthCheckResponse> = await this.api.get('/health');
    return response.data;
  }

  // 2. Get Room Transcript
  async getRoomTranscript(
    roomId: string, 
    params?: TranscriptQueryParams
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}`,
      { params }
    );
    return response.data;
  }

  // 3. Get Participant Transcript
  async getParticipantTranscript(
    roomId: string,
    participantId: string,
    params?: Omit<TranscriptQueryParams, 'participantId'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}/participant/${participantId}`,
      { params }
    );
    return response.data;
  }

  // 4. Generate Transcript (POST)
  async generateTranscript(request: GenerateTranscriptRequest): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.post(
      '/generate',
      request
    );
    return response.data;
  }

  // 5. Format-Specific Endpoints

  // Raw Text Format
  async getRoomTranscriptRaw(
    roomId: string,
    params?: Omit<TranscriptQueryParams, 'format'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}/raw`,
      { params }
    );
    return response.data;
  }

  // Timestamped Format
  async getRoomTranscriptTimestamped(
    roomId: string,
    params?: Omit<TranscriptQueryParams, 'format'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}/timestamped`,
      { params }
    );
    return response.data;
  }

  // Participant-Separated Format
  async getRoomTranscriptParticipants(
    roomId: string,
    params?: Omit<TranscriptQueryParams, 'format'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}/participants`,
      { params }
    );
    return response.data;
  }

  // Detailed Format
  async getRoomTranscriptDetailed(
    roomId: string,
    params?: Omit<TranscriptQueryParams, 'format'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.get(
      `/room/${roomId}/detailed`,
      { params }
    );
    return response.data;
  }

  // 6. Force Re-Transcription

  // Re-transcribe Room
  async retranscribeRoom(
    roomId: string,
    params?: TranscriptQueryParams
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.post(
      `/room/${roomId}/retranscribe`,
      {},
      { params }
    );
    return response.data;
  }

  // Re-transcribe Participant
  async retranscribeParticipant(
    roomId: string,
    participantId: string,
    params?: Omit<TranscriptQueryParams, 'participantId'>
  ): Promise<TranscriptResponseDto> {
    const response: AxiosResponse<TranscriptResponseDto> = await this.api.post(
      `/room/${roomId}/participant/${participantId}/retranscribe`,
      {},
      { params }
    );
    return response.data;
  }

  // 7. Upgrade Transcript
  async upgradeTranscript(
    roomId: string,
    params?: UpgradeTranscriptParams
  ): Promise<UpgradeTranscriptResponse> {
    const response: AxiosResponse<UpgradeTranscriptResponse> = await this.api.post(
      `/room/${roomId}/upgrade`,
      {},
      { params }
    );
    return response.data;
  }

  // 8. Clear Cache
  async clearCache(
    roomId: string,
    params?: ClearCacheParams
  ): Promise<ClearCacheResponse> {
    const response: AxiosResponse<ClearCacheResponse> = await this.api.delete(
      `/room/${roomId}/cache`,
      { params }
    );
    return response.data;
  }

  // Convenience methods for common use cases

  // Get transcript with default settings (detailed format, base model, auto language)
  async getTranscriptDefault(roomId: string): Promise<TranscriptResponseDto> {
    return this.getRoomTranscript(roomId, {
      format: 'detailed',
      model: 'base',
      language: 'auto'
    });
  }

  // Get high-quality transcript (large-v3 model)
  async getTranscriptHighQuality(
    roomId: string,
    language: Language = 'auto'
  ): Promise<TranscriptResponseDto> {
    return this.getRoomTranscript(roomId, {
      format: 'detailed',
      model: 'large-v3',
      language,
      useCache: true
    });
  }

  // Force regenerate with high quality
  async regenerateHighQuality(
    roomId: string,
    language: Language = 'auto'
  ): Promise<TranscriptResponseDto> {
    return this.retranscribeRoom(roomId, {
      format: 'detailed',
      model: 'large-v3',
      language,
      forceRegenerate: true
    });
  }

  // Get participant transcript with high quality
  async getParticipantTranscriptHighQuality(
    roomId: string,
    participantId: string,
    language: Language = 'auto'
  ): Promise<TranscriptResponseDto> {
    return this.getParticipantTranscript(roomId, participantId, {
      format: 'detailed',
      model: 'large-v3',
      language,
      useCache: true
    });
  }

  // Upgrade existing transcript to better model
  async upgradeToLargeV3(
    roomId: string,
    language: Language = 'auto',
    fromModel?: WhisperModel
  ): Promise<UpgradeTranscriptResponse> {
    return this.upgradeTranscript(roomId, {
      fromModel,
      toModel: 'large-v3',
      language
    });
  }

  // Clear all cache for a room
  async clearAllCache(roomId: string): Promise<ClearCacheResponse> {
    return this.clearCache(roomId);
  }

  // Clear cache for specific model
  async clearCacheForModel(
    roomId: string, 
    model: WhisperModel
  ): Promise<ClearCacheResponse> {
    return this.clearCache(roomId, { model });
  }
}

// Export singleton instance
export const transcriptService = new TranscriptService();
export default transcriptService;