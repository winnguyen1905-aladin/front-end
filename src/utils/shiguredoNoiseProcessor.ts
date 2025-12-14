// PROFESSIONAL AUDIO PROCESSOR - Giải pháp toàn diện
// Sử dụng AudioWorklet cho smooth processing ở sample level

/**
 * Optimal audio constraints
 */
export function getOptimalAudioConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: false, // Tắt browser's NS - dùng ML thay thế
    autoGainControl: false,   // Tắt AGC - tự control gain
    sampleRate: 48000,
    channelCount: 1,
  };
}

export interface AudioProcessorConfig {
  assetsPath?: string;
  // Dynamics
  targetLevel?: number;              // Target RMS level, default: 0.3
  gateThreshold?: number;            // Noise gate threshold (linear), default: 0.002
}

export interface AudioProcessor {
  getProcessedStream: () => MediaStream;
  getProcessedTrack: () => MediaStreamTrack;
  setTargetLevel: (level: number) => void;
  setGateThreshold: (threshold: number) => void;
  stop: () => void;
  isRunning: () => boolean;
  getMetrics: () => AudioMetrics;
}

export interface AudioMetrics {
  inputLevel: number;
  outputLevel: number;
  isVoiceActive: boolean;
  gainReduction: number;
}

const DEFAULT_ASSETS_PATH = 'https://cdn.jsdelivr.net/npm/@shiguredo/noise-suppression@latest/dist';

// AudioWorklet processor code - Voice optimized with smooth gate
const WORKLET_CODE = `
class SmoothAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // ========== WARM-UP STATE ==========
    this.isWarmedUp = false;
    this.warmupFrames = 0;
    this.warmupTarget = 15;
    this.fadeInProgress = 0;
    this.fadeInDuration = 96;
    
    // ========== SMOOTH NOISE GATE V3 - SPEECH CONTINUITY ==========
    this.gateThreshold = 0.003;     // -50dB gate threshold
    this.gateGain = 0;              // Current gate gain (0-1)
    this.gateGainTarget = 0;
    this.gateOpenSpeed = 0.08;      // Slower open (no clicks!)
    this.gateCloseSpeed = 0.0008;   // Even slower close
    this.gateHoldCounter = 0;
    this.gateHoldTime = 19200;      // 400ms hold (đủ cho tiếng Việt)
    this.minGateGain = 0;           // Minimum gain when "in speech"
    
    // ========== SPEECH STATE DETECTION ==========
    this.inSpeechMode = false;      // Are we currently in a speech phrase?
    this.speechStartTime = 0;       // When did speech start?
    this.speechIdleCounter = 0;     // Frames since last strong signal
    this.speechIdleMax = 48000;     // 1 second of silence = end speech
    this.speechBridgeGain = 0.15;   // Keep 15% gain between words
    
    // ========== GATE FADE ENVELOPE (tránh bộp bộp) ==========
    this.gateFade = 0;              // Separate fade for each gate open
    this.gateFadeSpeed = 0.05;      // Smooth fade in/out
    
    // ========== RMS WINDOW (phát hiện voice tốt hơn) ==========
    this.rmsWindow = new Array(10).fill(0);
    this.rmsWindowIndex = 0
    
    // ========== LOOKAHEAD BUFFER ==========
    this.rmsHistory = new Array(30).fill(0);  // 30 frames history
    this.rmsHistoryIndex = 0
    
  //   // ========== WARM-UP STATE ==========
  //   this.isWarmedUp = false;
  //   this.warmupFrames = 0;
  //   this.warmupTarget = 15;
  //   this.fadeInProgress = 0;
  //   this.fadeInDuration = 96;
    
  //   // ========== SMOOTH NOISE GATE V3 - SPEECH CONTINUITY ==========
  //   this.gateThreshold = 0.003;     // -50dB gate threshold
  //   this.gateGain = 0;              // Current gate gain (0-1)
  //   this.gateGainTarget = 0;
  //   this.gateOpenSpeed = 0.08;      // Slower open (no clicks!)
  //   this.gateCloseSpeed = 0.0008;   // Even slower close
  //   this.gateHoldCounter = 0;
  //   this.gateHoldTime = 19200;      // 400ms hold (đủ cho tiếng Việt)
  //   this.minGateGain = 0;           // Minimum gain when "in speech"
    
  //   // ========== ENVELOPE FOLLOWER (for dynamics) ==========
  //   this.envelope = 0;
  //   this.envelopeAttack = 0.02;     // Fast attack
  //   this.envelopeRelease = 0.9997;  // Very slow release - KEY for smoothness
    
  //   // ========== ADAPTIVE GAIN ==========
  //   this.targetRMS = 0.3;
  //   this.currentGain = 1.0;
  //   this.gainSmoothing = 0.9995;    // Slow gain changes
    
  //   // ========== COMPRESSION (glues words together) ==========
  //   this.compThreshold = 0.4;       // Start compressing at 40%
  //   this.compRatio = 3;             // 3:1 ratio
  //   this.compKnee = 0.2;            // Soft knee

  //   // ========== GATE FADE ENVELOPE (tránh bộp bộp) ==========
  //   this.gateFade = 0;              // Separate fade for each gate open
  //   this.gateFadeSpeed = 0.05;      // Smooth fade in/out
    
  //   // ========== RMS WINDOW (phát hiện voice tốt hơn) ==========
  //   this.rmsWindow = new Array(10).fill(0);
  //   this.rmsWindowIndex = 0
    
  //   // ========== METRICS ==========
  //   this.inputRMS = 0;
  //   this.outputRMS = 0;
  //   this.frameCount = 0;
    
  //   // ========== MESSAGE HANDLING ==========
  //   this.port.onmessage = (e) => {
  //     if (e.data.type === 'setTargetLevel') {
  //       this.targetRMS = Math.max(0.1, Math.min(0.5, e.data.value));
  //     } else if (e.data.type === 'setGateThreshold') {
  //       this.gateThreshold = e.data.value;
  //     }
  //   };
  // }
  
  // Soft-knee compression
  compress(sample) {
    const abs = Math.abs(sample);
    if (abs <= this.compThreshold - this.compKnee) {
      return sample; // Below threshold, no compression
    }
    
    const sign = sample >= 0 ? 1 : -1;
    
    if (abs >= this.compThreshold + this.compKnee) {
      // Above knee, full compression
      const excess = abs - this.compThreshold;
      const compressed = this.compThreshold + excess / this.compRatio;
      return sign * compressed;
    }
    
    // In knee region, gradual compression
    const kneeStart = this.compThreshold - this.compKnee;
    const kneePos = (abs - kneeStart) / (2 * this.compKnee);
    const ratio = 1 + (this.compRatio - 1) * kneePos * kneePos;
    const excess = abs - kneeStart;
    return sign * (kneeStart + excess / ratio);
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    const frameLength = inputChannel.length;
    
    this.frameCount++;
    
    // ========== CALCULATE INPUT RMS ==========
    let sumSquares = 0;
    for (let i = 0; i < frameLength; i++) {
      sumSquares += inputChannel[i] * inputChannel[i];
    }
    this.inputRMS = Math.sqrt(sumSquares / frameLength);
    
    // ========== WARM-UP PHASE ==========
    if (!this.isWarmedUp) {
      this.warmupFrames++;
      for (let i = 0; i < frameLength; i++) {
        outputChannel[i] = 0;
      }
      this.envelope = Math.max(this.envelope, this.inputRMS * 0.5);
      if (this.warmupFrames >= this.warmupTarget) {
        this.isWarmedUp = true;
        this.fadeInProgress = 0;
      }
      return true;
    }
    
    // ========== NOISE GATE WITH HOLD ==========
    if (this.inputRMS > this.gateThreshold) {
      this.gateGainTarget = 1.0;
      this.gateHoldCounter = this.gateHoldTime;
    } else if (this.gateHoldCounter > 0) {
      this.gateHoldCounter -= frameLength;
      this.gateGainTarget = 1.0; // Keep open during hold
    } else {
      this.gateGainTarget = 0.0;
    }
    
    // Asymmetric gate smoothing (fast open, slow close)
    if (this.gateGainTarget > this.gateGain) {
      this.gateGain += (this.gateGainTarget - this.gateGain) * this.gateOpenSpeed;
    } else {
      this.gateGain += (this.gateGainTarget - this.gateGain) * this.gateCloseSpeed;
    }
    
    // ========== ADAPTIVE GAIN (only when gate open) ==========
    if (this.gateGain > 0.5 && this.inputRMS > 0.01) {
      const desiredGain = this.targetRMS / (this.inputRMS + 0.001);
      const clampedGain = Math.max(0.7, Math.min(2.5, desiredGain));
      this.currentGain = this.currentGain * this.gainSmoothing + 
                         clampedGain * (1 - this.gainSmoothing);
    }
    
    // ========== PROCESS SAMPLES ==========
    for (let i = 0; i < frameLength; i++) {
      let sample = inputChannel[i];
      
      // 1. Apply adaptive gain
      sample *= this.currentGain;
      
      // 2. Envelope follower (per-sample for smoothness)
      const absSample = Math.abs(sample);
      if (absSample > this.envelope) {
        this.envelope += (absSample - this.envelope) * this.envelopeAttack;
      } else {
        this.envelope *= this.envelopeRelease;
      }
      
      // 3. Soft compression (glues words together)
      sample = this.compress(sample);
      
      // 4. Apply smooth gate
      sample *= this.gateGain;
      
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
    
    // ========== CALCULATE OUTPUT RMS ==========
    sumSquares = 0;
    for (let i = 0; i < frameLength; i++) {
      sumSquares += outputChannel[i] * outputChannel[i];
    }
    this.outputRMS = Math.sqrt(sumSquares / frameLength);
    
    // ========== SEND METRICS ==========
    if (this.frameCount % 50 === 0) {
      this.port.postMessage({
        type: 'metrics',
        inputLevel: this.inputRMS,
        outputLevel: this.outputRMS,
        isVoiceActive: this.gateGain > 0.5,
        gainReduction: this.envelope > this.compThreshold ? 
          (this.envelope - this.compThreshold) / this.envelope : 0
      });
    }
    
    return true;
  }
}

registerProcessor('smooth-audio-processor', SmoothAudioProcessor);
`;

/**
 * Creates a professional audio processor with smooth output
 */
export async function createAudioProcessor(
  sourceStream: MediaStream,
  config: AudioProcessorConfig = {}
): Promise<AudioProcessor> {
  const audioTrack = sourceStream.getAudioTracks()[0];
  if (!audioTrack) {
    throw new Error('No audio track in source stream');
  }
  
  if (audioTrack.readyState !== 'live') {
    throw new Error(`Audio track is not live (state: ${audioTrack.readyState})`);
  }

  const assetsPath = config.assetsPath || DEFAULT_ASSETS_PATH;
  const targetLevel = config.targetLevel ?? 0.3;
  const gateThreshold = config.gateThreshold ?? 0.002;
  
  // Create AudioContext
  const audioContext = new AudioContext({ 
    sampleRate: 48000,
    latencyHint: 'interactive'
  });
  
  let mlProcessedTrack: MediaStreamTrack | null = null;
  
  // Try to use ML noise suppression
  try {
    const hasTrackProcessorSupport = typeof (window as any).MediaStreamTrackProcessor !== 'undefined';
    const hasTrackGeneratorSupport = typeof (window as any).MediaStreamTrackGenerator !== 'undefined';
    
    if (hasTrackProcessorSupport && hasTrackGeneratorSupport) {
      const noiseModule = await import('@shiguredo/noise-suppression');
      const ProcessorClass = noiseModule.NoiseSuppressionProcessor;
      
      if (ProcessorClass) {
        const processor = new (ProcessorClass as new (assetsPath: string) => any)(assetsPath);
        const trackToProcess = audioTrack.clone();
        mlProcessedTrack = await processor.startProcessing(trackToProcess);
        
        if (mlProcessedTrack) {
          console.log('✅ ML Noise Suppression enabled');
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ ML Noise Suppression failed, using fallback:', error);
  }
  
  // Use ML track if available, otherwise use original
  const trackToUse = mlProcessedTrack || audioTrack;
  const streamToProcess = new MediaStream([trackToUse]);
  
  // Create audio source
  const source = audioContext.createMediaStreamSource(streamToProcess);
  
  // ==========================================
  // PRE-PROCESSING: EQ & Filtering
  // ==========================================
  
  // 1. High-pass filter (remove rumble/handling noise)
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 85;
  highPass.Q.value = 0.707;
  
  // 2. Low-shelf (add warmth to voice)
  const lowShelf = audioContext.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 250;
  lowShelf.gain.value = 2;
  
  // 3. Presence boost (clarity)
  const presenceBoost = audioContext.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = 3500;
  presenceBoost.Q.value = 1.5;
  presenceBoost.gain.value = 4;
  
  // 4. De-esser (reduce sibilance)
  const deEsser = audioContext.createBiquadFilter();
  deEsser.type = 'peaking';
  deEsser.frequency.value = 7000;
  deEsser.Q.value = 2;
  deEsser.gain.value = -3;
  
  // 5. Low-pass filter (remove harshness)
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 12000;
  lowPass.Q.value = 0.707;
  
  // ==========================================
  // MAIN PROCESSING: AudioWorklet
  // ==========================================
  
  // Register and create worklet
  const workletBlob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const workletUrl = URL.createObjectURL(workletBlob);
  await audioContext.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);
  
  const workletNode = new AudioWorkletNode(audioContext, 'smooth-audio-processor');
  
  // Set initial parameters
  workletNode.port.postMessage({ 
    type: 'setTargetLevel', 
    value: targetLevel 
  });
  workletNode.port.postMessage({ 
    type: 'setGateThreshold', 
    value: gateThreshold 
  });
  
  // ==========================================
  // POST-PROCESSING: Final polish
  // ==========================================
  
  // Final limiter
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  
  // Output destination
  const destination = audioContext.createMediaStreamDestination();
  
  // ==========================================
  // CONNECT THE CHAIN
  // ==========================================
  // Source -> EQ Chain -> Worklet (smooth processing) -> Limiter -> Destination
  
  source.connect(highPass);
  highPass.connect(lowShelf);
  lowShelf.connect(presenceBoost);
  presenceBoost.connect(deEsser);
  deEsser.connect(lowPass);
  lowPass.connect(workletNode);
  workletNode.connect(limiter);
  limiter.connect(destination);
  
  // ==========================================
  // METRICS & MONITORING
  // ==========================================
  
  let currentMetrics: AudioMetrics = {
    inputLevel: 0,
    outputLevel: 0,
    isVoiceActive: false,
    gainReduction: 0
  };
  
  workletNode.port.onmessage = (e) => {
    if (e.data.type === 'metrics') {
      currentMetrics = {
        inputLevel: e.data.inputLevel,
        outputLevel: e.data.outputLevel,
        isVoiceActive: e.data.isVoiceActive,
        gainReduction: e.data.gainReduction
      };
    }
  };
  
  let running = true;
  
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
      workletNode.port.postMessage({ 
        type: 'setGateThreshold', 
        value: Math.max(0.0005, Math.min(0.01, threshold))
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

// Export main function with backward compatibility
export const createShiguredoNoiseProcessor = createAudioProcessor;
