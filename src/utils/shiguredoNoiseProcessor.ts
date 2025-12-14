// ============================================================================
// PROFESSIONAL AUDIO PROCESSOR V2.1 - Balanced Mode
// ============================================================================
// Features:
// - ML Noise Suppression (Shiguredo)
// - Intelligent Voice Detection (relaxed thresholds)
// - Adaptive Noise Floor Tracking
// - Speech Continuity (high bridge gain for smooth flow)
// - Professional EQ Chain
// - Dynamic Compression & Limiting
// - Zero clicks/pops
// 
// V2.1 Changes (Less Aggressive):
// - Lower gate threshold: 0.0015 (was 0.003) - easier trigger
// - Faster gate open: 0.15 (was 0.08) - reduce "rè" sound
// - Longer hold time: 600ms (was 400ms) - less choppy
// - Higher bridge gain: 15% (was 8%) - smoother between words
// - Relaxed confidence: 0.25-0.4 (was 0.4-0.6) - less false negatives
// - Slower envelope release: 0.9999 (was 0.9998) - more natural tail
// ============================================================================

/**
 * Optimal audio constraints for voice capture
 */
export function getOptimalAudioConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: false,  // Use ML instead
    autoGainControl: false,   // Manual control
    sampleRate: 48000,
    channelCount: 1,
  };
}

/**
 * Configuration for audio processor
 */
export interface AudioProcessorConfig {
  assetsPath?: string;
  targetLevel?: number;       // Target RMS level (0.1-0.5), default: 0.3
  gateThreshold?: number;     // Gate threshold (0.0005-0.01), default: 0.0015 (lower = less noise rejection)
  bridgeGain?: number;        // Gain between words (0-0.2), default: 0.15 (higher = less choppy)
}

/**
 * Audio processor interface
 */ 
export interface AudioProcessor {
  getProcessedStream: () => MediaStream;
  getProcessedTrack: () => MediaStreamTrack;
  setTargetLevel: (level: number) => void;
  setGateThreshold: (threshold: number) => void;
  setBridgeGain: (gain: number) => void;
  stop: () => void;
  isRunning: () => boolean;
  getMetrics: () => AudioMetrics;
}

/**
 * Real-time audio metrics
 */
export interface AudioMetrics {
  inputLevel: number;
  outputLevel: number;
  isVoiceActive: boolean;
  gainReduction: number;
  inSpeechMode?: boolean;
  voiceConfidence?: number;
  noiseFloor?: number;
}

const DEFAULT_ASSETS_PATH = 'https://cdn.jsdelivr.net/npm/@shiguredo/noise-suppression@latest/dist';

// ============================================================================
// AUDIO WORKLET PROCESSOR - Clean & Organized
// ============================================================================

const WORKLET_CODE = `
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // ===== INITIALIZATION STATE =====
    this.isWarmedUp = false;
    this.warmupFrames = 0;
    this.warmupTarget = 15;
    this.fadeInProgress = 0;
    this.fadeInDuration = 96;
    this.frameCount = 0;
    
    // ===== NOISE GATE PARAMETERS =====
    this.gateThreshold = 0.0015;     // Giảm từ 0.003 → 0.0015 (dễ trigger hơn)
    this.gateGain = 0;
    this.gateGainTarget = 0;
    this.gateOpenSpeed = 0.15;       // Tăng từ 0.08 → 0.15 (mở nhanh hơn)
    this.gateCloseSpeed = 0.0005;    // Giảm từ 0.0008 → 0.0005 (đóng chậm hơn)
    this.gateHoldCounter = 0;
    this.gateHoldTime = 28800;       // Tăng từ 400ms → 600ms
    this.minGateGain = 0;
    
    // ===== GATE FADE (anti-click) =====
    this.gateFade = 0;
    this.gateFadeSpeed = 0.12;       // Tăng từ 0.05 → 0.12 (fade nhanh hơn)
    
    // ===== SPEECH STATE =====
    this.inSpeechMode = false;
    this.speechIdleCounter = 0;
    this.speechIdleMax = 72000;      // Tăng từ 1s → 1.5s
    this.speechBridgeGain = 0.15;    // Tăng từ 0.08 → 0.15 (giảm đứt quãng)
    this.voiceConfidence = 0;
    
    // ===== NOISE FLOOR TRACKING =====
    this.noiseFloor = 0.001;
    this.noiseFloorSamples = new Array(100).fill(0.001);
    this.noiseFloorIndex = 0;
    this.noiseFloorUpdateCounter = 0;
    
    // ===== ANALYSIS BUFFERS =====
    this.rmsWindow = new Array(10).fill(0);
    this.rmsWindowIndex = 0;
    this.rmsHistory = new Array(30).fill(0);
    this.rmsHistoryIndex = 0;
    
    // ===== SPECTRAL FEATURES =====
    this.zeroCrossingRate = 0;
    this.peakCount = 0;
    
    // ===== DYNAMICS =====
    this.envelope = 0;
    this.envelopeAttack = 0.02;
    this.envelopeRelease = 0.9999;   // Tăng từ 0.9998 → 0.9999 (chậm hơn)
    
    this.targetRMS = 0.3;
    this.currentGain = 1.0;
    this.gainSmoothing = 0.9995;
    
    this.compThreshold = 0.4;
    this.compRatio = 3;
    this.compKnee = 0.2;
    
    // ===== METRICS =====
    this.inputRMS = 0;
    this.outputRMS = 0;
    
    // ===== MESSAGE HANDLER =====
    this.port.onmessage = (e) => {
      switch (e.data.type) {
        case 'setTargetLevel':
          this.targetRMS = Math.max(0.1, Math.min(0.5, e.data.value));
          break;
        case 'setGateThreshold':
          this.gateThreshold = Math.max(0.0005, Math.min(0.01, e.data.value));
          break;
        case 'setBridgeGain':
          this.speechBridgeGain = Math.max(0, Math.min(0.2, e.data.value));
          break;
      }
    };
    
    // NOTE: Tuning tips
    // - If voice sounds choppy: increase bridgeGain (0.15 → 0.2)
    // - If too much noise: increase gateThreshold (0.0015 → 0.003)
    // - If cutting words: increase gateHoldTime (28800 → 38400)
    // - If "rè" sound at start: increase gateFadeSpeed (0.12 → 0.2)
  }
  
  // ==========================================================================
  // SPECTRAL ANALYSIS - Voice Detection
  // ==========================================================================
  
  analyzeSpectralFeatures(samples) {
    const len = samples.length;
    
    // Zero Crossing Rate (voice: low, noise: high)
    let zeroCrossings = 0;
    for (let i = 1; i < len; i++) {
      if ((samples[i-1] >= 0 && samples[i] < 0) || 
          (samples[i-1] < 0 && samples[i] >= 0)) {
        zeroCrossings++;
      }
    }
    this.zeroCrossingRate = zeroCrossings / len;
    
    // Peak Density (voice: structured, noise: random)
    let peaks = 0;
    for (let i = 2; i < len - 2; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > 0.01 &&
          abs > Math.abs(samples[i-1]) &&
          abs > Math.abs(samples[i+1])) {
        peaks++;
      }
    }
    this.peakCount = peaks;
  }
  
  // ==========================================================================
  // NOISE FLOOR ESTIMATION - Adaptive Background Tracking
  // ==========================================================================
  
  updateNoiseFloor() {
    // Only update when gate is closed (no voice)
    if (this.gateGain < 0.1) {
      this.noiseFloorUpdateCounter++;
      if (this.noiseFloorUpdateCounter >= 50) {  // Every 50 frames (~1 second)
        this.noiseFloorSamples[this.noiseFloorIndex] = this.inputRMS;
        this.noiseFloorIndex = (this.noiseFloorIndex + 1) % this.noiseFloorSamples.length;
        
        // Use median (robust to spikes)
        const sorted = [...this.noiseFloorSamples].sort((a, b) => a - b);
        this.noiseFloor = sorted[50];
        
        this.noiseFloorUpdateCounter = 0;
      }
    }
  }
  
  // ==========================================================================
  // VOICE CONFIDENCE SCORING - Multi-Feature Analysis
  // ==========================================================================
  
  calculateVoiceConfidence(avgRMS) {
    let confidence = 0;
    
    // 1. RMS Ratio (giảm yêu cầu)
    const rmsRatio = avgRMS / Math.max(this.noiseFloor, 0.0001);
    if (rmsRatio > 6) confidence += 0.4;        // Giảm từ 8 → 6
    else if (rmsRatio > 4) confidence += 0.3;   // Giảm từ 5 → 4
    else if (rmsRatio > 2.5) confidence += 0.2; // Giảm từ 3 → 2.5, tăng từ 0.15 → 0.2
    
    // 2. Zero Crossing Rate (nới lỏng range)
    if (this.zeroCrossingRate >= 0.02 && this.zeroCrossingRate <= 0.35) {  // Nới từ 0.03-0.25 → 0.02-0.35
      confidence += 0.25;  // Giảm từ 0.3 → 0.25
    } else if (this.zeroCrossingRate > 0.45) {  // Nới từ 0.4 → 0.45
      confidence -= 0.15;  // Giảm penalty từ -0.2 → -0.15
    }
    
    // 3. Peak Structure (nới lỏng)
    if (this.peakCount > 3 && this.peakCount < 40) {  // Nới từ 5-30 → 3-40
      confidence += 0.2;
    }
    
    // 4. Signal Stability (nới lỏng)
    const variance = this.rmsWindow.reduce((sum, val) => {
      const diff = val - avgRMS;
      return sum + diff * diff;
    }, 0) / this.rmsWindow.length;
    
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (avgRMS + 0.0001);
    
    if (cv < 0.7) {  // Nới từ 0.5 → 0.7
      confidence += 0.15;  // Tăng từ 0.1 → 0.15
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  // ==========================================================================
  // SOFT-KNEE COMPRESSION - Glues Words Together
  // ==========================================================================
  
  compress(sample) {
    const abs = Math.abs(sample);
    const sign = sample >= 0 ? 1 : -1;
    
    // Below knee
    if (abs <= this.compThreshold - this.compKnee) {
      return sample;
    }
    
    // Above knee
    if (abs >= this.compThreshold + this.compKnee) {
      const excess = abs - this.compThreshold;
      return sign * (this.compThreshold + excess / this.compRatio);
    }
    
    // In knee region (smooth transition)
    const kneeStart = this.compThreshold - this.compKnee;
    const kneePos = (abs - kneeStart) / (2 * this.compKnee);
    const ratio = 1 + (this.compRatio - 1) * kneePos * kneePos;
    const excess = abs - kneeStart;
    return sign * (kneeStart + excess / ratio);
  }
  
  // ==========================================================================
  // MAIN PROCESS - Sample-by-Sample Processing
  // ==========================================================================
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input?.[0] || !output?.[0]) {
      return true;
    }
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    const frameLength = inputChannel.length;
    
    this.frameCount++;
    
    // ===== CALCULATE INPUT RMS =====
    let sumSquares = 0;
    for (let i = 0; i < frameLength; i++) {
      sumSquares += inputChannel[i] * inputChannel[i];
    }
    this.inputRMS = Math.sqrt(sumSquares / frameLength);
    
    // ===== WARM-UP PHASE (prevent initial click) =====
    if (!this.isWarmedUp) {
      this.warmupFrames++;
      outputChannel.fill(0);
      this.envelope = Math.max(this.envelope, this.inputRMS * 0.5);
      
      if (this.warmupFrames >= this.warmupTarget) {
        this.isWarmedUp = true;
        this.fadeInProgress = 0;
      }
      return true;
    }
    
    // ===== ANALYZE SPECTRAL FEATURES =====
    this.analyzeSpectralFeatures(inputChannel);
    
    // ===== UPDATE RMS BUFFERS =====
    this.rmsWindow[this.rmsWindowIndex] = this.inputRMS;
    this.rmsWindowIndex = (this.rmsWindowIndex + 1) % this.rmsWindow.length;
    const avgRMS = this.rmsWindow.reduce((a, b) => a + b) / this.rmsWindow.length;
    
    this.rmsHistory[this.rmsHistoryIndex] = this.inputRMS;
    this.rmsHistoryIndex = (this.rmsHistoryIndex + 1) % this.rmsHistory.length;
    
    // ===== UPDATE NOISE FLOOR =====
    this.updateNoiseFloor();
    
    // ===== CALCULATE VOICE CONFIDENCE =====
    this.voiceConfidence = this.calculateVoiceConfidence(avgRMS);
    
    // ===== LOOKAHEAD DETECTION =====
    const recentMaxRMS = Math.max(...this.rmsHistory.slice(-10));
    const hasRecentActivity = recentMaxRMS > Math.max(
      this.gateThreshold * 1.2,     // Giảm từ 1.5 → 1.2
      this.noiseFloor * 3           // Giảm từ 4 → 3
    );
    
    // ===== SPEECH STATE MACHINE =====
    const isStrongVoice = avgRMS > Math.max(
      this.gateThreshold * 2,       // Giảm từ 3 → 2
      this.noiseFloor * 4           // Giảm từ 6 → 4
    ) && this.voiceConfidence > 0.35;  // Giảm từ 0.5 → 0.35
    
    if (isStrongVoice) {
      if (!this.inSpeechMode) {
        this.inSpeechMode = true;
      }
      this.speechIdleCounter = 0;
    } else if (this.inSpeechMode) {
      this.speechIdleCounter += frameLength;
      if (this.speechIdleCounter > this.speechIdleMax) {
        this.inSpeechMode = false;
        this.minGateGain = 0;
      }
    }
    
    // ===== INTELLIGENT GATE CONTROL =====
    const isVoiceSignal = avgRMS > this.gateThreshold && this.voiceConfidence > 0.25;  // Giảm từ 0.4 → 0.25
    
    if (isVoiceSignal) {
      // Voice detected → full open
      this.gateGainTarget = 1.0;
      this.gateHoldCounter = this.gateHoldTime;
      this.minGateGain = (this.inSpeechMode && this.voiceConfidence > 0.4)  // Giảm từ 0.6 → 0.4
        ? this.speechBridgeGain : 0;
        
    } else if (this.gateHoldCounter > 0) {
      // Hold period → stay open
      this.gateHoldCounter -= frameLength;
      this.gateGainTarget = 1.0;
      this.minGateGain = (this.inSpeechMode && this.voiceConfidence > 0.3)  // Giảm từ 0.5 → 0.3
        ? this.speechBridgeGain : 0;
        
    } else if (this.inSpeechMode && hasRecentActivity && this.voiceConfidence > 0.3) {  // Giảm từ 0.5 → 0.3
      // Speech bridging → keep connection
      this.gateGainTarget = this.speechBridgeGain;
      this.minGateGain = this.speechBridgeGain;
      
    } else {
      // Silence or noise → close
      this.gateGainTarget = 0.0;
      this.minGateGain = 0;
    }
    
    // ===== SMOOTH GATE TRANSITIONS =====
    const targetGain = Math.max(this.gateGainTarget, this.minGateGain);
    
    if (targetGain > this.gateGain) {
      this.gateGain += (targetGain - this.gateGain) * this.gateOpenSpeed;
    } else {
      this.gateGain += (targetGain - this.gateGain) * this.gateCloseSpeed;
    }
    
    // ===== GATE FADE (anti-click layer) =====
    if (this.gateGain > 0.9) {
      this.gateFade = Math.min(1, this.gateFade + this.gateFadeSpeed);
    } else if (this.gateGain < 0.1) {
      this.gateFade = Math.max(0, this.gateFade - this.gateFadeSpeed);
    }
    
    // ===== ADAPTIVE GAIN (when gate open) =====
    if (this.gateGain > 0.7 && avgRMS > this.gateThreshold * 1.5) {
      const desiredGain = this.targetRMS / (avgRMS + 0.001);
      const clampedGain = Math.max(0.7, Math.min(2.5, desiredGain));
      this.currentGain = this.currentGain * this.gainSmoothing + 
                         clampedGain * (1 - this.gainSmoothing);
    }
    
    // ===== SAMPLE-BY-SAMPLE PROCESSING =====
    for (let i = 0; i < frameLength; i++) {
      let sample = inputChannel[i];
      
      // 1. Adaptive gain
      sample *= this.currentGain;
      
      // 2. Envelope follower (smooth dynamics)
      const absSample = Math.abs(sample);
      if (absSample > this.envelope) {
        this.envelope += (absSample - this.envelope) * this.envelopeAttack;
      } else {
        this.envelope *= this.envelopeRelease;
      }
      
      // 3. Compression (glue)
      sample = this.compress(sample);
      
      // 4. Double-layer gate (gateGain × gateFade)
      const finalGate = this.gateGain * this.gateFade;
      sample *= finalGate;
      
      // 5. Soft limiter
      if (Math.abs(sample) > 0.85) {
        sample = Math.tanh(sample * 1.2) / 1.2;
      }
      
      // 6. Fade-in after warmup
      if (this.fadeInProgress < this.fadeInDuration) {
        sample *= this.fadeInProgress / this.fadeInDuration;
        this.fadeInProgress++;
      }
      
      outputChannel[i] = sample;
    }
    
    // ===== CALCULATE OUTPUT RMS =====
    sumSquares = 0;
    for (let i = 0; i < frameLength; i++) {
      sumSquares += outputChannel[i] * outputChannel[i];
    }
    this.outputRMS = Math.sqrt(sumSquares / frameLength);
    
    // ===== SEND METRICS =====
    if (this.frameCount % 50 === 0) {
      this.port.postMessage({
        type: 'metrics',
        inputLevel: this.inputRMS,
        outputLevel: this.outputRMS,
        isVoiceActive: this.gateGain > 0.3,
        gainReduction: this.envelope > this.compThreshold 
          ? (this.envelope - this.compThreshold) / this.envelope 
          : 0,
        inSpeechMode: this.inSpeechMode,
        voiceConfidence: this.voiceConfidence,
        noiseFloor: this.noiseFloor
      });
    }
    
    return true;
  }
}

registerProcessor('voice-processor', VoiceProcessor);
`;

// ============================================================================
// MAIN AUDIO PROCESSOR FACTORY
// ============================================================================

/**
 * Creates a professional audio processor with ML noise suppression
 * 
 * @example
 * // Balanced mode (default) - good for most use cases
 * const processor = await createAudioProcessor(stream);
 * 
 * @example
 * // Low noise environment - prioritize smoothness
 * const processor = await createAudioProcessor(stream, {
 *   gateThreshold: 0.001,   // Very low threshold
 *   bridgeGain: 0.2         // Maximum smoothness
 * });
 * 
 * @example
 * // High noise environment - prioritize noise rejection
 * const processor = await createAudioProcessor(stream, {
 *   gateThreshold: 0.005,   // Higher threshold
 *   bridgeGain: 0.08        // Less bridge gain
 * });
 */
export async function createAudioProcessor(
  sourceStream: MediaStream,
  config: AudioProcessorConfig = {}
): Promise<AudioProcessor> {
  
  // ===== VALIDATE INPUT =====
  const audioTrack = sourceStream.getAudioTracks()[0];
  if (!audioTrack) {
    throw new Error('No audio track in source stream');
  }
  
  if (audioTrack.readyState !== 'live') {
    throw new Error(`Audio track is not live (state: ${audioTrack.readyState})`);
  }

  // ===== CONFIGURATION =====
  const assetsPath = config.assetsPath || DEFAULT_ASSETS_PATH;
  const targetLevel = config.targetLevel ?? 0.3;
  const gateThreshold = config.gateThreshold ?? 0.0015;  // Giảm từ 0.003 → 0.0015
  const bridgeGain = config.bridgeGain ?? 0.15;          // Tăng từ 0.08 → 0.15
  
  // ===== CREATE AUDIO CONTEXT =====
  const audioContext = new AudioContext({ 
    sampleRate: 48000,
    latencyHint: 'interactive'
  });
  
  // ===== ML NOISE SUPPRESSION (OPTIONAL) =====
  let mlProcessedTrack: MediaStreamTrack | null = null;
  
  try {
    const hasTrackProcessor = typeof (window as any).MediaStreamTrackProcessor !== 'undefined';
    const hasTrackGenerator = typeof (window as any).MediaStreamTrackGenerator !== 'undefined';
    
    if (hasTrackProcessor && hasTrackGenerator) {
      const noiseModule = await import('@shiguredo/noise-suppression');
      const ProcessorClass = noiseModule.NoiseSuppressionProcessor;
      
      if (ProcessorClass) {
        const processor = new (ProcessorClass as any)(assetsPath);
        const trackToProcess = audioTrack.clone();
        mlProcessedTrack = await processor.startProcessing(trackToProcess);
        
        if (mlProcessedTrack) {
          console.log('✅ ML Noise Suppression enabled');
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ ML Noise Suppression unavailable, using fallback processing', error);
  }
  
  // ===== PREPARE STREAM =====
  const trackToUse = mlProcessedTrack || audioTrack;
  const streamToProcess = new MediaStream([trackToUse]);
  const source = audioContext.createMediaStreamSource(streamToProcess);
  
  // ============================================================================
  // PRE-PROCESSING CHAIN - Professional EQ
  // ============================================================================
  
  // 1. High-pass: Remove rumble (< 85Hz)
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 85;
  highPass.Q.value = 0.707;
  
  // 2. Low-shelf: Add warmth (250Hz +2dB)
  const lowShelf = audioContext.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 250;
  lowShelf.gain.value = 2;
  
  // 3. Presence: Clarity (3.5kHz +4dB)
  const presenceBoost = audioContext.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = 3500;
  presenceBoost.Q.value = 1.5;
  presenceBoost.gain.value = 4;
  
  // 4. De-esser: Reduce sibilance (7kHz -3dB)
  const deEsser = audioContext.createBiquadFilter();
  deEsser.type = 'peaking';
  deEsser.frequency.value = 7000;
  deEsser.Q.value = 2;
  deEsser.gain.value = -3;
  
  // 5. Low-pass: Remove harshness (> 12kHz)
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 12000;
  lowPass.Q.value = 0.707;
  
  // ============================================================================
  // CORE PROCESSING - AudioWorklet
  // ============================================================================
  
  const workletBlob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const workletUrl = URL.createObjectURL(workletBlob);
  await audioContext.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);
  
  const workletNode = new AudioWorkletNode(audioContext, 'voice-processor');
  
  // Set initial parameters
  workletNode.port.postMessage({ type: 'setTargetLevel', value: targetLevel });
  workletNode.port.postMessage({ type: 'setGateThreshold', value: gateThreshold });
  workletNode.port.postMessage({ type: 'setBridgeGain', value: bridgeGain });
  
  // ============================================================================
  // POST-PROCESSING - Final Safety
  // ============================================================================
  
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  
  const destination = audioContext.createMediaStreamDestination();
  
  // ============================================================================
  // CONNECT SIGNAL CHAIN
  // ============================================================================
  // Source → EQ Chain → Worklet → Limiter → Output
  
  source.connect(highPass);
  highPass.connect(lowShelf);
  lowShelf.connect(presenceBoost);
  presenceBoost.connect(deEsser);
  deEsser.connect(lowPass);
  lowPass.connect(workletNode);
  workletNode.connect(limiter);
  limiter.connect(destination);
  
  // ============================================================================
  // METRICS & CONTROL
  // ============================================================================
  
  let currentMetrics: AudioMetrics = {
    inputLevel: 0,
    outputLevel: 0,
    isVoiceActive: false,
    gainReduction: 0,
    inSpeechMode: false,
    voiceConfidence: 0,
    noiseFloor: 0.001
  };
  
  workletNode.port.onmessage = (e) => {
    if (e.data.type === 'metrics') {
      currentMetrics = {
        inputLevel: e.data.inputLevel,
        outputLevel: e.data.outputLevel,
        isVoiceActive: e.data.isVoiceActive,
        gainReduction: e.data.gainReduction,
        inSpeechMode: e.data.inSpeechMode,
        voiceConfidence: e.data.voiceConfidence,
        noiseFloor: e.data.noiseFloor
      };
    }
  };
  
  let running = true;
  
  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================
  
  return {
    getProcessedStream: () => destination.stream,
    
    getProcessedTrack: () => destination.stream.getAudioTracks()[0],
    
    setTargetLevel: (level: number) => {
      workletNode.port.postMessage({ 
        type: 'setTargetLevel', 
        value: Math.max(0.1, Math.min(0.8, level))
      });
    },
    
    setGateThreshold: (threshold: number) => {
      // Range: 0.0005 (very sensitive) to 0.01 (very strict)
      workletNode.port.postMessage({ 
        type: 'setGateThreshold', 
        value: Math.max(0.0005, Math.min(0.01, threshold))
      });
    },
    
    setBridgeGain: (gain: number) => {
      workletNode.port.postMessage({
        type: 'setBridgeGain',
        value: Math.max(0, Math.min(0.2, gain))
      });
    },
    
    stop: () => {
      if (!running) return;
      running = false;
      
      try {
        source.disconnect();
        workletNode.disconnect();
        destination.disconnect();
      } catch {}
      
      audioContext.close().catch(() => {});
      
      if (mlProcessedTrack) {
        mlProcessedTrack.stop();
      }
    },
    
    isRunning: () => running,
    
    getMetrics: () => currentMetrics
  };
}

// Backward compatibility
export const createShiguredoNoiseProcessor = createAudioProcessor;
