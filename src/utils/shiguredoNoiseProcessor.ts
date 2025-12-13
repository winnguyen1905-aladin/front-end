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

// AudioWorklet processor code - Clean passthrough with minimal processing
const WORKLET_CODE = `
class SmoothAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // ========== WARM-UP STATE ==========
    this.isWarmedUp = false;
    this.warmupFrames = 0;
    this.warmupTarget = 15; // ~40ms at 128 samples/frame @ 48kHz
    this.fadeInProgress = 0;
    this.fadeInDuration = 96; // 2ms fade-in
    
    // ========== SMOOTH GAIN (no abrupt changes) ==========
    this.targetRMS = 0.3;
    this.outputGain = 1.0;
    this.gainSmoothing = 0.9997; // Very slow changes
    
    // ========== ENVELOPE FOR GATING ==========
    this.envelope = 0;
    this.gateThreshold = 0.002;  // -54dB noise gate
    this.gateRelease = 0.9998;   // Very slow release to avoid pumping
    this.gateAttack = 0.3;       // Fast attack to catch transients
    
    // ========== SMOOTH GATE GAIN (prevents clicks) ==========
    this.gateGain = 0;           // Start closed
    this.gateGainTarget = 0;
    this.gateGainSmoothing = 0.995; // Smooth gate transitions
    
    // ========== METRICS ==========
    this.inputRMS = 0;
    this.outputRMS = 0;
    this.frameCount = 0;
    
    // ========== MESSAGE HANDLING ==========
    this.port.onmessage = (e) => {
      if (e.data.type === 'setTargetLevel') {
        this.targetRMS = Math.max(0.1, Math.min(0.5, e.data.value));
      } else if (e.data.type === 'setGateThreshold') {
        this.gateThreshold = e.data.value;
      }
    };
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
      
      // Output silence during warmup
      for (let i = 0; i < frameLength; i++) {
        outputChannel[i] = 0;
      }
      
      // Pre-warm the envelope
      this.envelope = Math.max(this.envelope, this.inputRMS);
      
      if (this.warmupFrames >= this.warmupTarget) {
        this.isWarmedUp = true;
        this.fadeInProgress = 0;
        // Start with gate closed
        this.gateGain = 0;
        this.gateGainTarget = 0;
      }
      
      return true;
    }
    
    // ========== ENVELOPE FOLLOWER ==========
    if (this.inputRMS > this.envelope) {
      this.envelope += (this.inputRMS - this.envelope) * this.gateAttack;
    } else {
      this.envelope *= this.gateRelease;
    }
    
    // ========== NOISE GATE (smooth transitions) ==========
    // Determine target gate state based on envelope
    if (this.envelope > this.gateThreshold) {
      this.gateGainTarget = 1.0; // Open gate
    } else if (this.envelope < this.gateThreshold * 0.5) {
      this.gateGainTarget = 0.0; // Close gate (with hysteresis)
    }
    
    // Smooth gate gain transition (prevents clicks)
    this.gateGain = this.gateGain * this.gateGainSmoothing + 
                    this.gateGainTarget * (1 - this.gateGainSmoothing);
    
    // ========== ADAPTIVE OUTPUT GAIN ==========
    // Only adjust gain when there's signal (prevents pumping)
    if (this.inputRMS > 0.01 && this.gateGain > 0.5) {
      const desiredGain = this.targetRMS / (this.inputRMS + 0.001);
      const clampedGain = Math.max(0.7, Math.min(2.0, desiredGain));
      this.outputGain = this.outputGain * this.gainSmoothing + 
                        clampedGain * (1 - this.gainSmoothing);
    }
    
    // ========== PROCESS SAMPLES ==========
    for (let i = 0; i < frameLength; i++) {
      let sample = inputChannel[i];
      
      // Apply output gain
      sample *= this.outputGain;
      
      // Apply smooth gate
      sample *= this.gateGain;
      
      // Soft limiter (transparent)
      if (Math.abs(sample) > 0.9) {
        sample = Math.tanh(sample);
      }
      
      // Fade-in after warmup
      if (this.fadeInProgress < this.fadeInDuration) {
        const fadeGain = this.fadeInProgress / this.fadeInDuration;
        sample *= fadeGain;
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
    
    // ========== SEND METRICS (less frequently) ==========
    if (this.frameCount % 50 === 0) {
      this.port.postMessage({
        type: 'metrics',
        inputLevel: this.inputRMS,
        outputLevel: this.outputRMS,
        isVoiceActive: this.gateGain > 0.5,
        gainReduction: 1 - this.gateGain
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
