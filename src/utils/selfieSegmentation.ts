// MediaPipe Selfie Segmentation utility for background blur/removal
// FIXED for production deployment

import type { Results } from '@mediapipe/selfie_segmentation';

export type SegmentationMode = 'blur' | 'remove' | 'virtual' | 'none';

export interface FaceEnhancementConfig {
  enabled: boolean;
  smoothing: number;
  whitening: number;
  sharpening: number;
}

export interface SegmentationConfig {
  mode: SegmentationMode;
  blurAmount?: number;
  virtualBackground?: string | HTMLImageElement | File;
  backgroundColor?: string;
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
  
  // OPTIMIZATION: Aggressively reduce resolution for ML processing
  // 160x120 is the minimum viable for segmentation, but 240x180 strikes a good balance
  // This drastically reduces CPU usage for the neural network
  const processWidth = Math.min(width, 240); 
  const processHeight = Math.min(height, 180);

  // Create video element
  const sourceVideo = document.createElement('video');
  sourceVideo.srcObject = sourceStream;
  sourceVideo.autoplay = true;
  sourceVideo.playsInline = true;
  sourceVideo.muted = true;
  sourceVideo.width = width;
  sourceVideo.height = height;

  // Create canvases
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d', { alpha: false })!;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d', { alpha: true })!;
  
  const mlCanvas = document.createElement('canvas');
  mlCanvas.width = processWidth;
  mlCanvas.height = processHeight;
  const mlCtx = mlCanvas.getContext('2d')!;

  // State
  let currentMode: SegmentationMode = config.mode;
  let blurAmount = config.blurAmount || 10;
  let backgroundColor = config.backgroundColor || '#ffffffff';
  let virtualBackground: HTMLImageElement | null = null;
  
  let faceEnhancement: FaceEnhancementConfig = {
    enabled: config.faceEnhancement?.enabled ?? true,
    smoothing: config.faceEnhancement?.smoothing ?? 30,
    whitening: config.faceEnhancement?.whitening ?? 20,
    sharpening: config.faceEnhancement?.sharpening ?? 25,
  };
  
  const enhanceCanvas = document.createElement('canvas');
  enhanceCanvas.width = width;
  enhanceCanvas.height = height;
  const enhanceCtx = enhanceCanvas.getContext('2d', { willReadFrequently: true })!;
  let running = false;

  // Load virtual background
  const loadVirtualBackground = async (bg: string | HTMLImageElement | File): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (bg instanceof File) {
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
  
  // Face enhancement functions (kept as-is)
  function applySkinSmoothing(imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const factor = intensity / 100;
    const radius = Math.max(1, Math.floor(3 * factor));
    const sigma = 20 + factor * 30;
    
    const copy = new Uint8ClampedArray(data);
    
    for (let y = radius; y < h - radius; y += 2) {
      for (let x = radius; x < w - radius; x += 2) {
        const idx = (y * w + x) * 4;
        
        let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
        const r0 = copy[idx], g0 = copy[idx + 1], b0 = copy[idx + 2];
        
        const isSkin = r0 > 60 && g0 > 40 && b0 > 20 && 
                       r0 > g0 && r0 > b0 && 
                       Math.abs(r0 - g0) > 15;
        
        if (!isSkin) continue;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nIdx = ((y + dy) * w + (x + dx)) * 4;
            const dr = copy[nIdx] - r0;
            const dg = copy[nIdx + 1] - g0;
            const db = copy[nIdx + 2] - b0;
            const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
            
            const weight = Math.exp(-colorDist / sigma);
            rSum += copy[nIdx] * weight;
            gSum += copy[nIdx + 1] * weight;
            bSum += copy[nIdx + 2] * weight;
            wSum += weight;
          }
        }
        
        if (wSum > 0) {
          const blend = factor * 0.7;
          data[idx] = Math.round(r0 * (1 - blend) + (rSum / wSum) * blend);
          data[idx + 1] = Math.round(g0 * (1 - blend) + (gSum / wSum) * blend);
          data[idx + 2] = Math.round(b0 * (1 - blend) + (bSum / wSum) * blend);
          
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
  
  function applySkinWhitening(imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const factor = intensity / 100;
    const brighten = 1 + factor * 0.15;
    const saturationReduce = 1 - factor * 0.1;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      
      const isSkin = r > 60 && g > 40 && b > 20 && 
                     r > g && r > b && 
                     Math.abs(r - g) > 15 &&
                     r - b > 15;
      
      if (isSkin) {
        let newR = Math.min(255, r * brighten);
        let newG = Math.min(255, g * brighten);
        let newB = Math.min(255, b * brighten);
        
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
  
  function applySharpening(ctx: CanvasRenderingContext2D, imageData: ImageData, intensity: number): void {
    if (intensity <= 0) return;
    
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const factor = intensity / 100;
    const amount = 0.3 + factor * 0.5;
    
    const copy = new Uint8ClampedArray(data);
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        
        for (let c = 0; c < 3; c++) {
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
          
          const sharpened = copy[idx + c] + (copy[idx + c] - blur) * amount;
          data[idx + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
        }
      }
    }
  }
  
  function applyFaceEnhancement(personImageData: ImageData): ImageData {
    if (!faceEnhancement.enabled) return personImageData;
    
    applySkinSmoothing(personImageData, faceEnhancement.smoothing);
    applySkinWhitening(personImageData, faceEnhancement.whitening);
    applySharpening(enhanceCtx, personImageData, faceEnhancement.sharpening);
    
    return personImageData;
  }

  // ========== FIXED MediaPipe Initialization ==========
  console.log('[selfieSegmentation] Initializing MediaPipe...');

  // Load SelfieSegmentation from CDN to avoid bundler issues in production
  const CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';
  
  // Check if already loaded globally
  let SelfieSegmentationClass = (window as any).SelfieSegmentation;
  
  if (!SelfieSegmentationClass) {
    // Load the script from CDN
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${CDN_URL}/selfie_segmentation.js`;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        console.log('[selfieSegmentation] CDN script loaded');
        resolve();
      };
      script.onerror = (e) => {
        console.error('[selfieSegmentation] CDN script failed to load', e);
        reject(new Error('Failed to load MediaPipe from CDN'));
      };
      document.head.appendChild(script);
    });
    
    SelfieSegmentationClass = (window as any).SelfieSegmentation;
  }

  console.log('[selfieSegmentation] SelfieSegmentation loaded:', typeof SelfieSegmentationClass);

  if (typeof SelfieSegmentationClass !== 'function') {
    throw new Error(`[selfieSegmentation] Failed to load SelfieSegmentation class from CDN. Got: ${typeof SelfieSegmentationClass}`);
  }

  const segmentation = new SelfieSegmentationClass({
    locateFile: (file: string) => `${CDN_URL}/${file}`,
  });

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
    
    createImageBitmap(results.segmentationMask).then(bitmap => {
      if (lastMask) lastMask.close();
      lastMask = bitmap;
    }).catch(() => {});
  });
  
  // OPTIMIZATION: Track visibility to pause processing when tab is hidden
  // This prevents audio distortion caused by heavy canvas processing
  let isPageVisible = !document.hidden;
  
  const handleVisibilityChange = () => {
    isPageVisible = !document.hidden;
    console.log('[selfieSegmentation] Page visibility changed:', isPageVisible ? 'visible' : 'hidden');
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Render loop - use simple setTimeout since we handle visibility ourselves
  let renderTimeoutId: number | null = null;
  let isRendering = false;
  
  // OPTIMIZATION: Reduce render FPS to 15fps to prioritize audio
  const TARGET_FPS = 15;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  
  function scheduleNextFrame() {
    if (!running) return;
    renderTimeoutId = window.setTimeout(renderFrame, FRAME_INTERVAL);
  }
  
  function renderFrame() {
    if (!running) return;
    
    // CRITICAL: When page is hidden, skip heavy processing to prevent audio distortion
    // Just draw the raw video frame without any effects
    if (!isPageVisible) {
      outputCtx.drawImage(sourceVideo, 0, 0, width, height);
      scheduleNextFrame();
      return;
    }
    
    if (isRendering) {
      scheduleNextFrame();
      return;
    }
    isRendering = true;
    
    try {
      if (currentMode === 'none' || !lastMask) {
        outputCtx.drawImage(sourceVideo, 0, 0, width, height);
      } else if (currentMode === 'remove') {
        // OPTIMIZATION: Use canvas compositing instead of pixel iteration
        outputCtx.fillStyle = backgroundColor;
        outputCtx.fillRect(0, 0, width, height);
        
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(sourceVideo, 0, 0, width, height);
        
        if (faceEnhancement.enabled) {
          const videoPixels = tempCtx.getImageData(0, 0, width, height);
          applyFaceEnhancement(videoPixels);
          tempCtx.putImageData(videoPixels, 0, 0);
        }
        
        // Use destination-in to cut out the person using the mask
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.translate(-width, 0);
        tempCtx.drawImage(lastMask, 0, 0, width, height);
        tempCtx.restore();
        tempCtx.globalCompositeOperation = 'source-over';
        
        // Draw the cut-out person onto the background
        outputCtx.drawImage(tempCanvas, 0, 0);
      } else if (currentMode === 'blur') {
        outputCtx.filter = `blur(${blurAmount}px)`;
        outputCtx.drawImage(sourceVideo, 0, 0, width, height);
        outputCtx.filter = 'none';
        
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(sourceVideo, 0, 0, width, height);
        
        if (faceEnhancement.enabled) {
          const personData = tempCtx.getImageData(0, 0, width, height);
          applyFaceEnhancement(personData);
          tempCtx.putImageData(personData, 0, 0);
        }
        
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.translate(-width, 0);
        tempCtx.drawImage(lastMask, 0, 0, width, height);
        tempCtx.restore();
        tempCtx.globalCompositeOperation = 'source-over';
        
        outputCtx.drawImage(tempCanvas, 0, 0);
      } else if (currentMode === 'virtual' && virtualBackground) {
        outputCtx.drawImage(virtualBackground, 0, 0, width, height);
        
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(sourceVideo, 0, 0, width, height);
        
        if (faceEnhancement.enabled) {
          const personData = tempCtx.getImageData(0, 0, width, height);
          applyFaceEnhancement(personData);
          tempCtx.putImageData(personData, 0, 0);
        }
        
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.translate(-width, 0);
        tempCtx.drawImage(lastMask, 0, 0, width, height);
        tempCtx.restore();
        tempCtx.globalCompositeOperation = 'source-over';
        
        outputCtx.drawImage(tempCanvas, 0, 0);
      } else {
        outputCtx.drawImage(sourceVideo, 0, 0, width, height);
      }
    } finally {
      isRendering = false;
      scheduleNextFrame();
    }
  }

  // ML processing loop
  let processingFrame = false;
  let framesSent = 0;
  let mlIntervalId: number | null = null;
  const ML_INTERVAL = 200; // 5fps for ML - low to save CPU
  
  async function processMLFrame() {
    if (!running || processingFrame) return;
    if (sourceVideo.readyState < 2) return;
    
    // CRITICAL: Skip ML processing when page is hidden to prevent audio distortion
    if (!isPageVisible) return;
    
    processingFrame = true;
    try {
      mlCtx.drawImage(sourceVideo, 0, 0, processWidth, processHeight);
      await segmentation.send({ image: mlCanvas });
      framesSent++;
    } catch (err) {
      // Silently handle errors
    }
    processingFrame = false;
  }

  let processedStream: MediaStream | null = null;
  const audioTracks = sourceStream.getAudioTracks();

  const processor: SegmentationProcessor = {
    start: async () => {
      if (running) return;
      
      console.log('[selfieSegmentation] Starting processor...');
      running = true;
      
      try {
        await sourceVideo.play();
        console.log('[selfieSegmentation] Video playing');
        
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
        
        outputCtx.drawImage(sourceVideo, 0, 0, width, height);
        
        // Match capture stream FPS to render FPS
        processedStream = outputCanvas.captureStream(TARGET_FPS);
        audioTracks.forEach(track => processedStream!.addTrack(track));
        
        // Start render loop with setTimeout
        scheduleNextFrame();
        
        // Start ML processing loop with setInterval
        mlIntervalId = window.setInterval(processMLFrame, ML_INTERVAL);
        
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      if (virtualBackground) {
        currentMode = 'virtual';
      }
    },

    setBackgroundColor: (color: string) => {
      backgroundColor = color;
    },

    isRunning: () => running,
    
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
