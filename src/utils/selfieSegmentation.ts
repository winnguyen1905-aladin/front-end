// MediaPipe Selfie Segmentation utility for background blur/removal
// Uses npm packages: @mediapipe/selfie_segmentation

import { SelfieSegmentation, Results } from '@mediapipe/selfie_segmentation';

export type SegmentationMode = 'blur' | 'remove' | 'virtual' | 'none';

export interface FaceEnhancementConfig {
  enabled: boolean;
  smoothing: number;   // 0-100, skin smoothing intensity
  whitening: number;   // 0-100, skin whitening/brightening
  sharpening: number;  // 0-100, edge sharpening for clarity
}

export interface SegmentationConfig {
  mode: SegmentationMode;
  blurAmount?: number; // 0-40, default 10
  virtualBackground?: string | HTMLImageElement | File;
  backgroundColor?: string; // For 'remove' mode, default is transparent black
  faceEnhancement?: FaceEnhancementConfig;
}

export interface SegmentationProcessor {
  start: () => Promise<void> | void;
  stop: () => void;
  getProcessedStream: () => MediaStream | null;
  setMode: (mode: SegmentationMode) => void;
  setBlurAmount: (amount: number) => void;
  setVirtualBackground: (bg: string | HTMLImageElement | File) => Promise<void>;
  setBackgroundColor: (color: string) => void;
  isRunning: () => boolean;
  // Face enhancement controls
  setFaceEnhancement: (config: Partial<FaceEnhancementConfig>) => void;
  getFaceEnhancement: () => FaceEnhancementConfig;
}

export async function createSegmentationProcessor(
  sourceStream: MediaStream,
  config: SegmentationConfig = { mode: 'blur', blurAmount: 10 }
): Promise<SegmentationProcessor> {
  const videoTrack = sourceStream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error('No video track in source stream');
  }

  const settings = videoTrack.getSettings();
  const width = settings.width || 640;
  const height = settings.height || 480;
  
  // Use full resolution for ML processing (high quality)
  const processWidth = width;
  const processHeight = height;

  // Create video element to receive source stream
  const sourceVideo = document.createElement('video');
  sourceVideo.srcObject = sourceStream;
  sourceVideo.autoplay = true;
  sourceVideo.playsInline = true;
  sourceVideo.muted = true;
  sourceVideo.width = width;
  sourceVideo.height = height;

  // Create main output canvas (full resolution for output)
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d', { alpha: false })!;

  // Create temporary canvas for compositing (full resolution)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d', { alpha: true })!;
  
  // Create small canvas for ML processing
  const mlCanvas = document.createElement('canvas');
  mlCanvas.width = processWidth;
  mlCanvas.height = processHeight;
  const mlCtx = mlCanvas.getContext('2d')!;
  
  // Debug canvas to visualize mask
  const debugCanvas = document.createElement('canvas');
  debugCanvas.width = width;
  debugCanvas.height = height;
  const debugCtx = debugCanvas.getContext('2d')!;

  // State
  let currentMode: SegmentationMode = config.mode;
  let blurAmount = config.blurAmount || 10;
  let backgroundColor = config.backgroundColor || '#ffffffff'; // Transparent black default
  let virtualBackground: HTMLImageElement | null = null;
  
  // Face enhancement state
  let faceEnhancement: FaceEnhancementConfig = {
    enabled: config.faceEnhancement?.enabled ?? true,
    smoothing: config.faceEnhancement?.smoothing ?? 30,
    whitening: config.faceEnhancement?.whitening ?? 20,
    sharpening: config.faceEnhancement?.sharpening ?? 25,
  };
  
  // Create enhancement canvas for face processing
  const enhanceCanvas = document.createElement('canvas');
  enhanceCanvas.width = width;
  enhanceCanvas.height = height;
  const enhanceCtx = enhanceCanvas.getContext('2d', { willReadFrequently: true })!;
  let running = false;

  // Load virtual background if provided
  const loadVirtualBackground = async (bg: string | HTMLImageElement | File): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (bg instanceof File) {
        // Handle File upload
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            virtualBackground = img;
            resolve();
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(bg);
      } else if (typeof bg === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          virtualBackground = img;
          resolve();
        };
        img.onerror = reject;
        img.src = bg;
      } else {
        virtualBackground = bg;
        resolve();
      }
    });
  };

  if (config.virtualBackground) {
    loadVirtualBackground(config.virtualBackground).catch(console.error);
  }
  
  // ========== FACE ENHANCEMENT FUNCTIONS ==========
  
  // Apply bilateral filter approximation for skin smoothing
  function applySkinSmoothing(imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const factor = intensity / 100;
    const radius = Math.max(1, Math.floor(3 * factor));
    const sigma = 20 + factor * 30; // Color similarity threshold
    
    // Create copy for reading
    const copy = new Uint8ClampedArray(data);
    
    // Simple bilateral-like smoothing (optimized for real-time)
    for (let y = radius; y < h - radius; y += 2) { // Skip every other row for performance
      for (let x = radius; x < w - radius; x += 2) { // Skip every other column
        const idx = (y * w + x) * 4;
        
        let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
        const r0 = copy[idx], g0 = copy[idx + 1], b0 = copy[idx + 2];
        
        // Check if this is likely skin (simplified detection)
        const isSkin = r0 > 60 && g0 > 40 && b0 > 20 && 
                       r0 > g0 && r0 > b0 && 
                       Math.abs(r0 - g0) > 15;
        
        if (!isSkin) continue;
        
        // Sample neighbors
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nIdx = ((y + dy) * w + (x + dx)) * 4;
            const dr = copy[nIdx] - r0;
            const dg = copy[nIdx + 1] - g0;
            const db = copy[nIdx + 2] - b0;
            const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
            
            // Weight based on color similarity
            const weight = Math.exp(-colorDist / sigma);
            rSum += copy[nIdx] * weight;
            gSum += copy[nIdx + 1] * weight;
            bSum += copy[nIdx + 2] * weight;
            wSum += weight;
          }
        }
        
        if (wSum > 0) {
          // Blend smoothed with original
          const blend = factor * 0.7;
          data[idx] = Math.round(r0 * (1 - blend) + (rSum / wSum) * blend);
          data[idx + 1] = Math.round(g0 * (1 - blend) + (gSum / wSum) * blend);
          data[idx + 2] = Math.round(b0 * (1 - blend) + (bSum / wSum) * blend);
          
          // Apply to neighbors too (fills in skipped pixels)
          if (x + 1 < w) {
            data[idx + 4] = data[idx];
            data[idx + 5] = data[idx + 1];
            data[idx + 6] = data[idx + 2];
          }
          if (y + 1 < h) {
            const nextRowIdx = ((y + 1) * w + x) * 4;
            data[nextRowIdx] = data[idx];
            data[nextRowIdx + 1] = data[idx + 1];
            data[nextRowIdx + 2] = data[idx + 2];
          }
        }
      }
    }
  }
  
  // Apply skin whitening/brightening
  function applySkinWhitening(imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const factor = intensity / 100;
    const brighten = 1 + factor * 0.15; // Up to 15% brighter
    const saturationReduce = 1 - factor * 0.1; // Slightly reduce saturation
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      
      // Detect skin tones
      const isSkin = r > 60 && g > 40 && b > 20 && 
                     r > g && r > b && 
                     Math.abs(r - g) > 15 &&
                     r - b > 15;
      
      if (isSkin) {
        // Convert to HSL-ish for better control
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        
        // Brighten and reduce saturation for whitening effect
        let newR = Math.min(255, r * brighten);
        let newG = Math.min(255, g * brighten);
        let newB = Math.min(255, b * brighten);
        
        // Reduce color saturation slightly (makes skin look cleaner)
        const gray = 0.299 * newR + 0.587 * newG + 0.114 * newB;
        newR = gray + (newR - gray) * saturationReduce;
        newG = gray + (newG - gray) * saturationReduce;
        newB = gray + (newB - gray) * saturationReduce;
        
        data[i] = Math.round(Math.min(255, newR));
        data[i + 1] = Math.round(Math.min(255, newG));
        data[i + 2] = Math.round(Math.min(255, newB));
      }
    }
  }
  
  // Apply sharpening using unsharp mask
  function applySharpening(ctx: CanvasRenderingContext2D, imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const factor = intensity / 100;
    const amount = 0.3 + factor * 0.5; // Sharpening strength
    
    // Create copy for reading
    const copy = new Uint8ClampedArray(data);
    
    // Simple unsharp mask (3x3 kernel)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          // Get surrounding pixels for blur
          const blur = (
            copy[((y-1) * w + (x-1)) * 4 + c] +
            copy[((y-1) * w + x) * 4 + c] * 2 +
            copy[((y-1) * w + (x+1)) * 4 + c] +
            copy[(y * w + (x-1)) * 4 + c] * 2 +
            copy[idx + c] * 4 +
            copy[(y * w + (x+1)) * 4 + c] * 2 +
            copy[((y+1) * w + (x-1)) * 4 + c] +
            copy[((y+1) * w + x) * 4 + c] * 2 +
            copy[((y+1) * w + (x+1)) * 4 + c]
          ) / 16;
          
          // Unsharp mask: original + (original - blur) * amount
          const sharpened = copy[idx + c] + (copy[idx + c] - blur) * amount;
          data[idx + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
        }
      }
    }
  }
  
  // Apply all face enhancements to person region
  function applyFaceEnhancement(personImageData: ImageData): ImageData {
    if (!faceEnhancement.enabled) return personImageData;
    
    // Apply in order: smoothing -> whitening -> sharpening
    applySkinSmoothing(personImageData, faceEnhancement.smoothing);
    applySkinWhitening(personImageData, faceEnhancement.whitening);
    applySharpening(enhanceCtx, personImageData, faceEnhancement.sharpening);
    
    return personImageData;
  }

  // Initialize MediaPipe Selfie Segmentation
  console.log('[selfieSegmentation] Initializing MediaPipe...');
  const segmentation = new SelfieSegmentation({
    locateFile: (file: string) => 
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });

  // Use model 1 (landscape) - better quality for video calls
  segmentation.setOptions({
    modelSelection: 1,
    selfieMode: true,
  });

  let frameCount = 0;
  let lastMask: ImageBitmap | null = null;
  
  segmentation.onResults((results: Results) => {
    frameCount++;
    if (frameCount === 1) {
      console.log('[selfieSegmentation] First frame received!');
    }
    
    if (!results.segmentationMask) return;
    if (!running) return;
    
    // Cache the mask for reuse between ML frames
    createImageBitmap(results.segmentationMask).then(bitmap => {
      if (lastMask) lastMask.close();
      lastMask = bitmap;
    }).catch(() => {});
    
  });
  
  // Render loop - use setTimeout instead of requestAnimationFrame for background tab support
  let renderTimeoutId: number | null = null;
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  
  function renderFrame() {
    if (!running) return;
    
    if (currentMode === 'none' || !lastMask) {
      // No processing - just draw original video
      outputCtx.drawImage(sourceVideo, 0, 0, width, height);
    } else if (currentMode === 'remove') {
      // Remove background - replace with solid color
      // Step 1: Draw background color
      outputCtx.fillStyle = backgroundColor;
      outputCtx.fillRect(0, 0, width, height);
      
      // Step 2: Manual pixel manipulation for mask
      // Get image data from video (no mirror - selfieMode handles it)
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(sourceVideo, 0, 0, width, height);
      const videoPixels = tempCtx.getImageData(0, 0, width, height);
      
      // Apply face enhancement to person pixels
      if (faceEnhancement.enabled) {
        applyFaceEnhancement(videoPixels);
      }
      
      // Draw mask mirrored horizontally to match
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.save();
      tempCtx.scale(-1, 1);
      tempCtx.translate(-width, 0);
      tempCtx.drawImage(lastMask, 0, 0, width, height);
      tempCtx.restore();
      const maskData = tempCtx.getImageData(0, 0, width, height);
      
      // Create output image data
      const outputData = tempCtx.createImageData(width, height);
      
      // Apply mask: check alpha channel (person = high alpha)
      // MediaPipe mask alpha: person=255, background=0
      for (let i = 0; i < maskData.data.length; i += 4) {
        // Check alpha channel (index 3) for mask
        const maskAlpha = maskData.data[i + 3];
        
        if (maskAlpha > 128) { // If alpha is high (person)
          // Copy video pixel (already enhanced)
          outputData.data[i] = videoPixels.data[i];     // R
          outputData.data[i + 1] = videoPixels.data[i + 1]; // G
          outputData.data[i + 2] = videoPixels.data[i + 2]; // B
          outputData.data[i + 3] = videoPixels.data[i + 3]; // A
        } else {
          // Transparent (background removed)
          outputData.data[i + 3] = 0;
        }
      }
      
      // Draw result
      tempCtx.putImageData(outputData, 0, 0);
      outputCtx.drawImage(tempCanvas, 0, 0);
    } else if (currentMode === 'blur') {
      // Blur background
      // Step 1: Draw blurred video as background
      outputCtx.filter = `blur(${blurAmount}px)`;
      outputCtx.drawImage(sourceVideo, 0, 0, width, height);
      outputCtx.filter = 'none';
      
      // Step 2: Extract person using mask with face enhancement
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(sourceVideo, 0, 0, width, height);
      
      // Apply face enhancement to person region
      if (faceEnhancement.enabled) {
        const personData = tempCtx.getImageData(0, 0, width, height);
        applyFaceEnhancement(personData);
        tempCtx.putImageData(personData, 0, 0);
      }
      
      // Draw mirrored mask to match video orientation
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.save();
      tempCtx.scale(-1, 1);
      tempCtx.translate(-width, 0);
      tempCtx.drawImage(lastMask, 0, 0, width, height);
      tempCtx.restore();
      tempCtx.globalCompositeOperation = 'source-over';
      
      // Step 3: Draw sharp person on top of blurred background
      outputCtx.drawImage(tempCanvas, 0, 0);
    } else if (currentMode === 'virtual' && virtualBackground) {
      // Virtual background
      outputCtx.drawImage(virtualBackground, 0, 0, width, height);
      
      // Extract person using mask with face enhancement
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(sourceVideo, 0, 0, width, height);
      
      // Apply face enhancement to person region
      if (faceEnhancement.enabled) {
        const personData = tempCtx.getImageData(0, 0, width, height);
        applyFaceEnhancement(personData);
        tempCtx.putImageData(personData, 0, 0);
      }
      
      // Draw mirrored mask to match video orientation
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.save();
      tempCtx.scale(-1, 1);
      tempCtx.translate(-width, 0);
      tempCtx.drawImage(lastMask, 0, 0, width, height);
      tempCtx.restore();
      tempCtx.globalCompositeOperation = 'source-over';
      
      // Draw person on top of virtual background
      outputCtx.drawImage(tempCanvas, 0, 0);
    } else {
      outputCtx.drawImage(sourceVideo, 0, 0, width, height);
    }
    
    // Use setTimeout for background tab support (requestAnimationFrame pauses in background)
    renderTimeoutId = window.setTimeout(renderFrame, FRAME_INTERVAL);
  }

  // ML processing loop - runs at lower rate (15fps) for performance
  let processingFrame = false;
  let framesSent = 0;
  let mlIntervalId: number | null = null;
  
  async function processMLFrame() {
    if (!running || processingFrame) return;
    if (sourceVideo.readyState < 2) return;
    
    processingFrame = true;
    try {
      // Draw scaled down frame to ML canvas
      mlCtx.drawImage(sourceVideo, 0, 0, processWidth, processHeight);
      await segmentation.send({ image: mlCanvas });
      framesSent++;
    } catch (err) {
      // Silently handle errors
    }
    processingFrame = false;
  }

  // Get processed stream from canvas - will be populated after first frame
  let processedStream: MediaStream | null = null;

  // Preserve audio track from source
  const audioTracks = sourceStream.getAudioTracks();

  const processor: SegmentationProcessor = {
    start: async () => {
      if (running) return;
      
      console.log('[selfieSegmentation] Starting processor...');
      running = true;
      
      try {
        await sourceVideo.play();
        console.log('[selfieSegmentation] Video playing');
        
        // Wait for video to have actual dimensions
        await new Promise<void>((resolve) => {
          const checkDimensions = () => {
            if (sourceVideo.videoWidth > 0 && sourceVideo.videoHeight > 0) {
              resolve();
            } else {
              requestAnimationFrame(checkDimensions);
            }
          };
          checkDimensions();
        });
        
        // Draw initial frame to canvas so it's not black
        outputCtx.drawImage(sourceVideo, 0, 0, width, height);
        
        // Create the stream from canvas
        processedStream = outputCanvas.captureStream(30);
        audioTracks.forEach(track => processedStream!.addTrack(track));
        
        // Start render loop (60fps for smooth output)
        renderFrame();
        
        // Start ML processing loop (30fps for high quality)
        mlIntervalId = window.setInterval(processMLFrame, 33); // ~30fps
        
        // Wait for first MediaPipe result
        await new Promise<void>((resolve) => {
          const checkFrames = () => {
            if (frameCount > 0) {
              console.log('[selfieSegmentation] Ready!');
              resolve();
            } else {
              setTimeout(checkFrames, 50);
            }
          };
          setTimeout(checkFrames, 50);
        });
      } catch (err) {
        console.error('[selfieSegmentation] Start failed:', err);
        running = false;
      }
    },

    stop: () => {
      running = false;
      if (renderTimeoutId !== null) {
        clearTimeout(renderTimeoutId);
        renderTimeoutId = null;
      }
      if (mlIntervalId !== null) {
        clearInterval(mlIntervalId);
        mlIntervalId = null;
      }
      if (lastMask) {
        lastMask.close();
        lastMask = null;
      }
      segmentation.close();
    },

    getProcessedStream: () => processedStream,

    setMode: (mode: SegmentationMode) => {
      currentMode = mode;
    },

    setBlurAmount: (amount: number) => {
      blurAmount = Math.max(0, Math.min(40, amount));
    },

    setVirtualBackground: async (bg: string | HTMLImageElement | File): Promise<void> => {
      await loadVirtualBackground(bg);
      // Auto-switch to virtual mode when background is set
      if (virtualBackground) {
        currentMode = 'virtual';
      }
    },

    setBackgroundColor: (color: string) => {
      backgroundColor = color;
    },

    isRunning: () => running,
    
    // Face enhancement controls
    setFaceEnhancement: (config: Partial<FaceEnhancementConfig>) => {
      faceEnhancement = {
        ...faceEnhancement,
        ...config,
      };
      console.log('[selfieSegmentation] Face enhancement updated:', faceEnhancement);
    },
    
    getFaceEnhancement: () => ({ ...faceEnhancement }),
  };

  return processor;
}
