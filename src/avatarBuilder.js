import { ImageSegmenter, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

export class AvatarBuilder {
  constructor(videoElement, previewCanvas) {
    this.video = videoElement;
    this.previewCanvas = previewCanvas;
    this.ctx = this.previewCanvas.getContext('2d');
    
    this.targetSize = 64; 
    this.pixelSize = 16;
    this.finalImageDataUrl = null;

    this.segmenter = null;
    this.isModelLoading = true;
    this.initModel();
  }

  async initModel() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
          delegate: "CPU"
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });
      
      this.isModelLoading = false;
      document.getElementById('loading-overlay').classList.add('hidden');
    } catch (e) {
      console.error("Failed to load segmenter model", e);
      document.getElementById('loading-text').innerText = "Failed to load AI.";
    }
  }

  async startCamera() {
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      }
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch (err) {
        console.warn("Fallback to generic video", err);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      this.video.srcObject = stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => resolve(true)).catch(e => {
            console.error("Video play failed:", e);
            resolve(true);
          });
        };
      });
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert(`Could not access camera: ${err.message || err.name}. Please upload a photo instead.`);
      return false;
    }
  }

  stopCamera() {
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }
  }

  async captureFaceFromVideo() {
    if (!this.video.srcObject) return null;
    return await this.processImageWithSegmenter(this.video);
  }

  handleFileUpload(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const result = await this.processImageWithSegmenter(img);
        URL.revokeObjectURL(url);
        resolve(result);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async processImageWithSegmenter(source) {
    if (this.isModelLoading || !this.segmenter) {
      alert("AI model is still loading, please wait a moment.");
      return null;
    }

    // Determine the size for segmentation
    let oWidth, oHeight;
    if (source instanceof HTMLVideoElement) {
      oWidth = source.videoWidth;
      oHeight = source.videoHeight;
    } else {
      oWidth = source.naturalWidth || source.width;
      oHeight = source.naturalHeight || source.height;
    }

    // Resize to a manageable max dimension (e.g. 512) for mobile safety and performance
    const MAX_DIM = 512;
    let scale = 1;
    if (oWidth > MAX_DIM || oHeight > MAX_DIM) {
      scale = MAX_DIM / Math.max(oWidth, oHeight);
    }
    const procWidth = Math.floor(oWidth * scale);
    const procHeight = Math.floor(oHeight * scale);

    // Create a temporary canvas for the scaled source image
    const procCanvas = document.createElement('canvas');
    procCanvas.width = procWidth;
    procCanvas.height = procHeight;
    const procCtx = procCanvas.getContext('2d');
    
    // Draw the scaled image (this also bakes in EXIF rotation on mobile)
    if (source instanceof HTMLVideoElement) {
      procCtx.translate(procWidth, 0);
      procCtx.scale(-1, 1);
    }
    procCtx.drawImage(source, 0, 0, procWidth, procHeight);
    procCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Segment the scaled image
    const segmentationResult = this.segmenter.segment(procCanvas);
    const mask = segmentationResult.categoryMask; 
    
    const maskArr = mask.getAsUint8Array();
    const maskW = mask.width;
    const maskH = mask.height;

    const imageData = procCtx.getImageData(0, 0, procWidth, procHeight);
    const data = imageData.data;
    
    // Categories: 1: hair, 3: face
    const keepClasses = new Set([1, 3]);

    let minX = procWidth, minY = procHeight, maxX = 0, maxY = 0;
    let foundPixels = false;

    for (let y = 0; y < procHeight; y++) {
      for (let x = 0; x < procWidth; x++) {
        // Map (x, y) from procCanvas to mask coordinates
        const mx = Math.floor((x / procWidth) * maskW);
        const my = Math.floor((y / procHeight) * maskH);
        const category = maskArr[my * maskW + mx];

        const index = (y * procWidth + x) * 4;

        if (!keepClasses.has(category)) {
          // Make background/body/clothes transparent
          data[index + 3] = 0; // Alpha channel
        } else {
          // Keep pixel, track bounding box
          foundPixels = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!foundPixels) {
      console.warn("No face/hair found in the image.");
      // Fallback: just use a center square
      const size = Math.min(procWidth, procHeight);
      minX = (procWidth - size) / 2;
      minY = (procHeight - size) / 2;
      maxX = minX + size;
      maxY = minY + size;
    } else {
      // Put the modified transparent image data back
      procCtx.putImageData(imageData, 0, 0);

      // Add a small 5% padding around the extracted face/hair
      const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(procWidth, maxX + padding);
      maxY = Math.min(procHeight, maxY + padding);
    }

    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;

    // We want the final bounding box to be roughly square so it doesn't squish weirdly
    const maxDim = Math.max(faceWidth, faceHeight);
    const centerX = minX + faceWidth / 2;
    const centerY = minY + faceHeight / 2;
    
    let finalX = Math.max(0, centerX - maxDim / 2);
    let finalY = Math.max(0, centerY - maxDim / 2);
    let finalSize = maxDim;

    // Prevent going out of bounds
    if (finalX + finalSize > procWidth) finalSize = procWidth - finalX;
    if (finalY + finalSize > procHeight) finalSize = procHeight - finalY;

    this.pixelateCanvas(procCanvas, finalX, finalY, finalSize, finalSize);
    return this.finalImageDataUrl;
  }

  pixelateCanvas(sourceCanvas, sx, sy, sWidth, sHeight) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.pixelSize;
    offCanvas.height = this.pixelSize;
    const offCtx = offCanvas.getContext('2d');
    
    offCtx.imageSmoothingEnabled = true;
    offCtx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, this.pixelSize, this.pixelSize);

    this.previewCanvas.width = this.targetSize;
    this.previewCanvas.height = this.targetSize;
    this.ctx.imageSmoothingEnabled = false;
    
    this.ctx.clearRect(0, 0, this.targetSize, this.targetSize);
    this.ctx.drawImage(offCanvas, 0, 0, this.pixelSize, this.pixelSize, 0, 0, this.targetSize, this.targetSize);
    
    this.finalImageDataUrl = this.previewCanvas.toDataURL('image/png');
  }

  getAvatarDataUrl() {
    return this.finalImageDataUrl;
  }
}
