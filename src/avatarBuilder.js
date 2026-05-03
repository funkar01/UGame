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
          delegate: "GPU"
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this.video.srcObject = stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve(true);
        };
      });
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access camera. Please upload a photo instead.");
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
    let sWidth, sHeight;
    if (source instanceof HTMLVideoElement) {
      sWidth = source.videoWidth;
      sHeight = source.videoHeight;
    } else {
      sWidth = source.width;
      sHeight = source.height;
    }

    // Center crop coordinates to make it square first
    const size = Math.min(sWidth, sHeight);
    const sx = (sWidth - size) / 2;
    const sy = (sHeight - size) / 2;

    // Create a temporary canvas for the cropped source image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = size;
    cropCanvas.height = size;
    const cropCtx = cropCanvas.getContext('2d');
    
    // Draw the square cropped center
    cropCtx.drawImage(source, sx, sy, size, size, 0, 0, size, size);

    // Segment the image
    const segmentationResult = this.segmenter.segment(cropCanvas);
    const mask = segmentationResult.categoryMask; 
    
    // We need to scale the mask back to the cropCanvas size to apply it correctly.
    // The categoryMask is a Uint8Array of shape [mask.width, mask.height].
    const maskArr = mask.getAsUint8Array();
    const maskW = mask.width;
    const maskH = mask.height;

    const imageData = cropCtx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    // Categories: 1: hair, 3: face
    const keepClasses = new Set([1, 3]);

    let minX = size, minY = size, maxX = 0, maxY = 0;
    let foundPixels = false;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Map (x, y) from cropCanvas to mask coordinates
        const mx = Math.floor((x / size) * maskW);
        const my = Math.floor((y / size) * maskH);
        const category = maskArr[my * maskW + mx];

        const index = (y * size + x) * 4;

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
      // Fallback: just use the whole crop
      minX = 0; minY = 0; maxX = size; maxY = size;
    } else {
      // Put the modified transparent image data back
      cropCtx.putImageData(imageData, 0, 0);

      // Add a small 5% padding around the extracted face/hair
      const padding = size * 0.05;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(size, maxX + padding);
      maxY = Math.min(size, maxY + padding);
    }

    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;

    // We want the final bounding box to be roughly square so it doesn't squish weirdly
    // Let's force it to be square based on the max dimension
    const maxDim = Math.max(faceWidth, faceHeight);
    const centerX = minX + faceWidth / 2;
    const centerY = minY + faceHeight / 2;
    
    const finalX = Math.max(0, centerX - maxDim / 2);
    const finalY = Math.max(0, centerY - maxDim / 2);
    // Adjust size if it goes out of bounds
    const finalSize = Math.min(maxDim, size - finalX, size - finalY);

    this.pixelateCanvas(cropCanvas, finalX, finalY, finalSize, finalSize);
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
