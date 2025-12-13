// MediaPipe Selfie Segmentation utility for background blur/removal
// Uses npm packages: @mediapipe/selfie_segmentation

import { SelfieSegmentation, Results } from '@mediapipe/selfie_segmentation';

export type SegmentationMode = 'blur' | 'remove' | 'virtual' | 'none';

export interface SegmentationConfig {
  mode: SegmentationMode;
  blurAmount?: number; // 0-40, default 10
  virtualBackground?: string | HTMLImageElement;
  backgroundColor?: string; // For 'remove' mode, default is transparent black
}

export interface SegmentationProcessor {
  start: () => Promise<void> | void;
  stop: () => void;
  getProcessedStream: () => MediaStream | null;
  setMode: (mode: SegmentationMode) => void;
  setBlurAmount: (amount: number) => void;
  setVirtualBackground: (bg: string | HTMLImageElement) => void;
  setBackgroundColor: (color: string) => void;
  isRunning: () => boolean;
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
  let running = false;

  // Load virtual background if provided
  if (config.virtualBackground) {
    if (typeof config.virtualBackground === 'string') {
      virtualBackground = new Image();
      virtualBackground.crossOrigin = 'anonymous';
      virtualBackground.src = config.virtualBackground;
    } else {
      virtualBackground = config.virtualBackground;
    }
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
          // Copy video pixel
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
      
      // Step 2: Extract person using mask
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(sourceVideo, 0, 0, width, height);
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(lastMask, 0, 0, width, height);
      tempCtx.globalCompositeOperation = 'source-over';
      
      // Step 3: Draw sharp person on top of blurred background
      outputCtx.drawImage(tempCanvas, 0, 0);
    } else if (currentMode === 'virtual' && virtualBackground) {
      // Virtual background
      outputCtx.drawImage(virtualBackground, 0, 0, width, height);
      
      // Extract person using mask
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(sourceVideo, 0, 0, width, height);
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(lastMask, 0, 0, width, height);
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

    setVirtualBackground: (bg: string | HTMLImageElement) => {
      if (typeof bg === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bg;
        virtualBackground = img;
      } else {
        virtualBackground = bg;
      }
    },

    setBackgroundColor: (color: string) => {
      backgroundColor = color;
    },

    isRunning: () => running,
  };

  return processor;
}
