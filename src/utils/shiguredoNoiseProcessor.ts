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
  // Voice smoothing
  smoothingWindowMs?: number;        // Default: 50ms crossfade
  comfortNoiseLevel?: number;        // 0-1, default: 0.02 (-34dB)
  // Dynamics
  targetLevel?: number;              // Target RMS level, default: 0.3
  compressionRatio?: number;         // Default: 3
  // VAD (Voice Activity Detection)
  vadThreshold?: number;             // -60 to 0 dB, default: -45
  vadHoldTimeMs?: number;            // Hold speech state, default: 300ms
}

export interface AudioProcessor {
  getProcessedStream: () => MediaStream;
  getProcessedTrack: () => MediaStreamTrack;
  setComfortNoise: (level: number) => void;
  setTargetLevel: (level: number) => void;
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

// AudioWorklet processor code - Fixed cold start issues
const WORKLET_CODE = `
class SmoothAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // ========== WARM-UP STATE ==========
    // Critical: Prevents scratchy audio on startup
    this.isWarmedUp = false;
    this.warmupFrames = 0;
    this.warmupTarget = 20; // ~10ms at 128 samples/frame @ 48kHz
    this.fadeInProgress = 0;
    this.fadeInDuration = 48; // ~1ms fade-in after warmup
    
    // ========== ENVELOPE FOLLOWER ==========
    this.envelope = 0;
    this.envelopeAttack = 0.01;    // Fast attack for transients
    this.envelopeRelease = 0.9995; // Slow release for smoothness
    
    // ========== VAD (Voice Activity Detection) ==========
    this.vadThreshold = 0.001;      // -60dB default
    this.vadHoldTime = 14400;       // 300ms at 48kHz
    this.vadHoldCounter = 0;
    this.isVoiceActive = false;
    
    // ========== COMFORT NOISE ==========
    this.comfortNoiseLevel = 0.0005;
    this.noiseState = [0, 0, 0, 0, 0, 0, 0]; // Pink noise filter state
    
    // ========== ADAPTIVE GAIN ==========
    this.targetRMS = 0.3;
    this.currentGain = 1.0;
    // Start with faster adaptation, then slow down
    this.gainSmoothingFast = 0.99;   // For initial convergence
    this.gainSmoothingSlow = 0.9995; // For stable operation
    this.gainConverged = false;
    this.gainConvergeCount = 0;
    
    // ========== METRICS ==========
    this.inputRMS = 0;
    this.outputRMS = 0;
    this.frameCount = 0;
    
    // ========== MESSAGE HANDLING ==========
    this.port.onmessage = (e) => {
      if (e.data.type === 'setComfortNoise') {
        this.comfortNoiseLevel = Math.max(0, Math.min(0.01, e.data.value));
      } else if (e.data.type === 'setTargetLevel') {
        this.targetRMS = Math.max(0.1, Math.min(0.5, e.data.value));
      } else if (e.data.type === 'setVadThreshold') {
        this.vadThreshold = e.data.value;
      }
    };
  }
  
  // Pink noise generator (sounds more natural than white noise)
  generatePinkNoise() {
    const white = Math.random() * 2 - 1;
    this.noiseState[0] = 0.99886 * this.noiseState[0] + white * 0.0555179;
    this.noiseState[1] = 0.99332 * this.noiseState[1] + white * 0.0750759;
    this.noiseState[2] = 0.96900 * this.noiseState[2] + white * 0.1538520;
    this.noiseState[3] = 0.86650 * this.noiseState[3] + white * 0.3104856;
    this.noiseState[4] = 0.55000 * this.noiseState[4] + white * 0.5329522;
    this.noiseState[5] = -0.7616 * this.noiseState[5] - white * 0.0168980;
    const pink = (this.noiseState[0] + this.noiseState[1] + this.noiseState[2] + 
                  this.noiseState[3] + this.noiseState[4] + this.noiseState[5] + 
                  this.noiseState[6] + white * 0.5362) * 0.11;
    this.noiseState[6] = white * 0.115926;
    return pink;
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
    
    // ========== WARM-UP PHASE ==========
    // Output silence during warm-up to prevent scratchy startup
    if (!this.isWarmedUp) {
      this.warmupFrames++;
      
      // During warmup: analyze input but output silence
      // This lets the gain/envelope stabilize
      let sumSquares = 0;
      for (let i = 0; i < frameLength; i++) {
        sumSquares += inputChannel[i] * inputChannel[i];
        outputChannel[i] = 0; // Silent output
      }
      this.inputRMS = Math.sqrt(sumSquares / frameLength);
      
      // Pre-warm the envelope and gain
      if (this.inputRMS > 0.001) {
        this.envelope = Math.max(this.envelope, this.inputRMS * 0.5);
        const desiredGain = this.targetRMS / (this.inputRMS + 0.001);
        this.currentGain = Math.max(0.5, Math.min(2.0, desiredGain));
      }
      
      if (this.warmupFrames >= this.warmupTarget) {
        this.isWarmedUp = true;
        this.fadeInProgress = 0;
      }
      
      return true;
    }
    
    // ========== CALCULATE INPUT RMS ==========
    let sumSquares = 0;
    for (let i = 0; i < frameLength; i++) {
      sumSquares += inputChannel[i] * inputChannel[i];
    }
    this.inputRMS = Math.sqrt(sumSquares / frameLength);
    
    // ========== VAD ==========
    this.updateVAD(this.inputRMS);
    
    // ========== ADAPTIVE GAIN ==========
    if (this.inputRMS > 0.005) {
      const desiredGain = this.targetRMS / (this.inputRMS + 0.001);
      const clampedGain = Math.max(0.5, Math.min(2.5, desiredGain));
      
      // Use faster smoothing until gain converges
      const smoothingFactor = this.gainConverged ? 
        this.gainSmoothingSlow : this.gainSmoothingFast;
      
      this.currentGain = this.currentGain * smoothingFactor + 
                         clampedGain * (1 - smoothingFactor);
      
      // Check if gain has converged (stable for ~50 frames)
      if (!this.gainConverged) {
        this.gainConvergeCount++;
        if (this.gainConvergeCount > 50) {
          this.gainConverged = true;
        }
      }
    }
    
    // ========== PROCESS SAMPLES ==========
    for (let i = 0; i < frameLength; i++) {
      let sample = inputChannel[i];
      
      // Apply gain
      sample *= this.currentGain;
      
      // Envelope follower
      const absSample = Math.abs(sample);
      if (absSample > this.envelope) {
        this.envelope += (absSample - this.envelope) * this.envelopeAttack;
      } else {
        this.envelope *= this.envelopeRelease;
      }
      
      // Soft compression (gentle, avoids pumping)
      if (this.envelope > 0.6) {
        const excess = this.envelope - 0.6;
        const compressionRatio = 1 / (1 + excess * 2); // Soft knee
        sample *= compressionRatio;
      }
      
      // Add comfort noise when silent (prevents dead air)
      if (!this.isVoiceActive && this.comfortNoiseLevel > 0) {
        sample += this.generatePinkNoise() * this.comfortNoiseLevel;
      }
      
      // Soft limiter (transparent, prevents clipping)
      sample = Math.tanh(sample * 0.9) / 0.9;
      
      // Fade-in after warmup (prevents click)
      if (this.fadeInProgress < this.fadeInDuration) {
        const fadeGain = this.fadeInProgress / this.fadeInDuration;
        sample *= fadeGain * fadeGain; // Quadratic fade for smoothness
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
    
    // ========== SEND METRICS (throttled) ==========
    if (this.frameCount % 10 === 0) {
      this.port.postMessage({
        type: 'metrics',
        inputLevel: this.inputRMS,
        outputLevel: this.outputRMS,
        isVoiceActive: this.isVoiceActive,
        gainReduction: this.envelope > 0.6 ? (this.envelope - 0.6) / 0.4 : 0
      });
    }
    
    return true;
  }
  
  updateVAD(rms) {
    if (rms > this.vadThreshold) {
      this.isVoiceActive = true;
      this.vadHoldCounter = this.vadHoldTime;
    } else if (this.vadHoldCounter > 0) {
      this.vadHoldCounter -= 128; // Decrement by frame size
      this.isVoiceActive = this.vadHoldCounter > 0;
    } else {
      this.isVoiceActive = false;
    }
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
  const comfortNoiseLevel = config.comfortNoiseLevel ?? 0.02;
  const targetLevel = config.targetLevel ?? 0.3;
  const vadThreshold = config.vadThreshold ?? -45; // dB
  
  // Create AudioContext
  const audioContext = new AudioContext({ 
    sampleRate: 48000,
    latencyHint: 'interactive'
  });
  
  let mlProcessedTrack: MediaStreamTrack | null = null;
  let useMLSuppression = false;
  
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
          useMLSuppression = true;
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
    type: 'setComfortNoise', 
    value: comfortNoiseLevel 
  });
  workletNode.port.postMessage({ 
    type: 'setTargetLevel', 
    value: targetLevel 
  });
  workletNode.port.postMessage({ 
    type: 'setVadThreshold', 
    value: Math.pow(10, vadThreshold / 20) 
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
    
    setComfortNoise: (level: number) => {
      workletNode.port.postMessage({ 
        type: 'setComfortNoise', 
        value: Math.max(0, Math.min(0.1, level))
      });
    },
    
    setTargetLevel: (level: number) => {
      workletNode.port.postMessage({ 
        type: 'setTargetLevel', 
        value: Math.max(0.1, Math.min(0.8, level))
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
