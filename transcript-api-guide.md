# Transcript API Guide

## Overview

The Transcript API provides comprehensive speech-to-text functionality with support for multiple languages, models, and response formats. It uses OpenAI Whisper for transcription and includes intelligent caching for performance optimization.

**Base URL**: `http://127.0.0.1:8090/transcripts`

## Authentication

Currently, no authentication is required for this API.

## Response Format

All successful responses follow this structure:

```typescript
interface TranscriptResponseDto {
  roomId: string;
  format: 'raw_text' | 'timestamped' | 'participant_separated' | 'detailed';
  language: 'auto' | 'vi' | 'en';
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
  generatedAt: string; // ISO timestamp
  cached: boolean; // Whether response came from cache
  processingTime?: number; // Processing time in milliseconds (detailed format)
  
  // Format-specific data
  rawText?: string;
  timestamped?: TimestampedSegment[];
  participants?: ParticipantTranscript[];
  detailed?: DetailedTranscript;
}
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `auto` | Language code: `auto`, `vi`, `en` |
| `model` | string | `base` | Whisper model: `tiny`, `base`, `small`, `medium`, `large`, `large-v2`, `large-v3` |
| `format` | string | `detailed` | Response format: `raw_text`, `timestamped`, `participant_separated`, `detailed` |
| `useCache` | boolean | `true` | Whether to use cached results |
| `forceRegenerate` | boolean | `false` | Force regeneration even if cache exists |
| `participantId` | string | `all` | Filter by specific participant ID |

## Endpoints

### 1. Health Check

Check API health and available endpoints.

```http
GET /transcripts/health
```

**Response**:
```json
{
  "status": "ok",
  "service": "transcript-api",
  "timestamp": "2025-12-19T15:19:07.803Z",
  "endpoints": [...],
  "features": {
    "Multiple Models": ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
    "Languages": ["auto", "vi", "en"],
    "Response Formats": ["raw_text", "timestamped", "participant_separated", "detailed"],
    "Caching": "Smart caching with language detection",
    "Force Regeneration": "Re-transcribe with better models"
  }
}
```

---

### 2. Get Room Transcript

Get transcript for all participants in a room.

```http
GET /transcripts/room/{roomId}
```

**Example**:
```bash
curl "http://127.0.0.1:8090/transcripts/room/abc123?language=vi&model=large-v3&format=detailed"
```

**Response**: Returns transcript data in specified format.

---

### 3. Get Participant Transcript

Get transcript for a specific participant in a room.

```http
GET /transcripts/room/{roomId}/participant/{participantId}
```

**Example**:
```bash
curl "http://127.0.0.1:8090/transcripts/room/abc123/participant/user456?language=en&format=timestamped"
```

---

### 4. Generate Transcript (POST)

Generate transcript with complex request body.

```http
POST /transcripts/generate
Content-Type: application/json
```

**Request Body**:
```json
{
  "roomId": "abc123",
  "participantId": "user456", // Optional
  "language": "vi",
  "model": "large-v3",
  "format": "detailed",
  "useCache": true,
  "forceRegenerate": false
}
```

---

### 5. Format-Specific Endpoints

#### Raw Text Format
```http
GET /transcripts/room/{roomId}/raw
```
Returns only the transcribed text.

#### Timestamped Format
```http
GET /transcripts/room/{roomId}/timestamped
```
Returns text with timestamps.

#### Participant-Separated Format
```http
GET /transcripts/room/{roomId}/participants
```
Returns transcripts grouped by participant.

#### Detailed Format (Default)
```http
GET /transcripts/room/{roomId}/detailed
```
Returns comprehensive transcript with all metadata.

---

### 6. Force Re-Transcription

Force re-transcription with new parameters, bypassing old cache but saving new results.

#### Re-transcribe Room
```http
POST /transcripts/room/{roomId}/retranscribe
```

**Example**:
```bash
curl -X POST "http://127.0.0.1:8090/transcripts/room/abc123/retranscribe?model=large-v3&language=vi&format=detailed"
```

#### Re-transcribe Participant
```http
POST /transcripts/room/{roomId}/participant/{participantId}/retranscribe
```

**Example**:
```bash
curl -X POST "http://127.0.0.1:8090/transcripts/room/abc123/participant/user456/retranscribe?model=large-v3"
```

---

### 7. Upgrade Transcript

Upgrade transcript to a better model.

```http
POST /transcripts/room/{roomId}/upgrade
```

**Parameters**:
- `fromModel` (optional): Current model to replace
- `toModel` (optional): Target model (defaults to `large-v3`)
- `language` (optional): Language for transcription
- `participantId` (optional): Specific participant

**Example**:
```bash
curl -X POST "http://127.0.0.1:8090/transcripts/room/abc123/upgrade?fromModel=base&toModel=large-v3&language=vi"
```

**Response**:
```json
{
  "upgraded": true,
  "oldModel": "base",
  "newModel": "large-v3",
  "transcript": { ... }
}
```

---

### 8. Clear Cache

Remove cached transcripts.

```http
DELETE /transcripts/room/{roomId}/cache
```

**Parameters**:
- `participantId` (optional): Clear only specific participant
- `language` (optional): Clear only specific language
- `model` (optional): Clear only specific model
- `format` (optional): Clear only specific format

**Example**:
```bash
curl -X DELETE "http://127.0.0.1:8090/transcripts/room/abc123/cache?model=base"
```

**Response**:
```json
{
  "cleared": true,
  "filesRemoved": 2
}
```

---

## Response Formats

### Raw Text
```json
{
  "rawText": "Hello world. This is a transcript."
}
```

### Timestamped
```json
{
  "timestamped": [
    {
      "text": "Hello world.",
      "start": 0.0,
      "end": 2.5,
      "confidence": 0.95
    },
    {
      "text": "This is a transcript.",
      "start": 2.5,
      "end": 5.0,
      "confidence": 0.92
    }
  ]
}
```

### Participant Separated
```json
{
  "participants": [
    {
      "participantId": "user123",
      "displayName": "John",
      "text": "Hello world.",
      "segments": [...],
      "totalDuration": 30.0,
      "confidence": 0.94
    }
  ]
}
```

### Detailed
```json
{
  "detailed": {
    "participants": [
      {
        "participantId": "user123",
        "displayName": "John",
        "segments": [
          {
            "segmentNumber": 0,
            "fileName": "John_user123_segment_000.wav",
            "start": 0,
            "end": 30.0,
            "text": "Hello world.",
            "confidence": 0.94,
            "whisperSegments": [...]
          }
        ],
        "totalDuration": 30.0,
        "confidence": 0.94
      }
    ],
    "totalDuration": 30.0,
    "averageConfidence": 0.94,
    "processingTime": 2456
  }
}
```

## Model Performance

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny | 39MB | Fastest | Low | Quick drafts |
| base | 74MB | Fast | Medium | General use |
| small | 244MB | Medium | Good | Better accuracy |
| medium | 769MB | Slow | Very Good | High quality |
| large | 1550MB | Very Slow | Excellent | Best quality |
| large-v2 | 1550MB | Very Slow | Excellent | Latest model |
| large-v3 | 1550MB | Very Slow | Best | State-of-the-art |

## Caching Behavior

- **Smart Cache Lookup**: When requesting `base` model, system automatically finds better cached models if available
- **Cache Key Format**: `{roomId}_{participantId}_{language}_{model}_{format}.json`
- **Cache Location**: `./temp/transcripts/`
- **Force Regeneration**: Use `forceRegenerate=true` to bypass cache and re-transcribe

## Error Handling

### Common Error Responses

**404 Not Found**:
```json
{
  "message": "No audio directory found for room {roomId}",
  "error": "Not Found",
  "statusCode": 404
}
```

**400 Bad Request**:
```json
{
  "message": "Invalid model: invalid_model",
  "error": "Bad Request",
  "statusCode": 400
}
```

**500 Internal Server Error**:
```json
{
  "message": "Transcription failed",
  "error": "Internal Server Error",
  "statusCode": 500
}
```

## Usage Examples

### Basic Usage
```bash
# Get transcript with default settings
curl "http://127.0.0.1:8090/transcripts/room/abc123"

# Get transcript with specific language and model
curl "http://127.0.0.1:8090/transcripts/room/abc123?language=vi&model=large-v3"
```

### Improving Quality
```bash
# Re-transcribe with better model
curl -X POST "http://127.0.0.1:8090/transcripts/room/abc123/retranscribe?model=large-v3&language=vi"

# Upgrade to best model
curl -X POST "http://127.0.0.1:8090/transcripts/room/abc123/upgrade"
```

### Different Formats
```bash
# Get raw text only
curl "http://127.0.0.1:8090/transcripts/room/abc123/raw"

# Get timestamped segments
curl "http://127.0.0.1:8090/transcripts/room/abc123/timestamped"

# Get participant-separated transcript
curl "http://127.0.0.1:8090/transcripts/room/abc123/participants"
```

### Cache Management
```bash
# Force regeneration without using cache
curl "http://127.0.0.1:8090/transcripts/room/abc123?forceRegenerate=true"

# Clear specific cache
curl -X DELETE "http://127.0.0.1:8090/transcripts/room/abc123/cache?model=base"
```

## Rate Limits

Currently, no rate limits are enforced. However, transcription is resource-intensive, so consider:
- Using cache whenever possible
- Choosing appropriate model size for your needs
- Implementing client-side rate limiting for production use

## Audio File Requirements

- **Format**: WAV files
- **Naming**: `{displayName}_{participantId}_segment_XXX.wav`
- **Location**: `./temp/audio-segments/{roomId}/`
- **Duration**: Typically 30-second segments

## Integration Tips

1. **Start with base model** for quick results
2. **Upgrade to large-v3** for final transcripts
3. **Use Vietnamese language** (`language=vi`) for Vietnamese content
4. **Check cached response** to avoid unnecessary re-transcription
5. **Monitor processingTime** in detailed format for performance

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify audio files exist in correct directory structure
- Ensure Python dependencies are installed for Whisper
- Check Redis connection if using distributed setup
