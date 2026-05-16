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
      // First try WebGL, fallback to CPU
      try {
        await tf.setBackend('webgl');
      } catch(e) {
        console.warn('WebGL failed, falling back to CPU for TFJS', e);
        await tf.setBackend('cpu');
      }

      const segmenterConfig = {
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.50,
        quantBytes: 2
      };
      this.segmenter = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.BodyPix,
        segmenterConfig
      );
      this.isModelLoading = false;
      document.getElementById('loading-overlay').classList.add('hidden');
    } catch (e) {
      console.error("Failed to load segmenter model", e);
      document.getElementById('loading-text').innerText = "Failed to load AI. Using fallback.";
      setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
      }, 1500);
      this.isModelLoading = false;
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
    if (this.isModelLoading) {
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

    const MAX_DIM = 512;
    let scale = 1;
    if (oWidth > MAX_DIM || oHeight > MAX_DIM) {
      scale = MAX_DIM / Math.max(oWidth, oHeight);
    }
    const procWidth = Math.floor(oWidth * scale);
    const procHeight = Math.floor(oHeight * scale);

    const procCanvas = document.createElement('canvas');
    procCanvas.width = procWidth;
    procCanvas.height = procHeight;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    
    if (source instanceof HTMLVideoElement) {
      procCtx.translate(procWidth, 0);
      procCtx.scale(-1, 1);
    }
    procCtx.drawImage(source, 0, 0, procWidth, procHeight);
    procCtx.setTransform(1, 0, 0, 1, 0, 0);

    let minX = procWidth, minY = procHeight, maxX = 0, maxY = 0;

    if (!this.segmenter) {
      console.warn("AI segmenter is not available. Using center crop fallback.");
      const size = Math.min(procWidth, procHeight);
      minX = (procWidth - size) / 2;
      minY = (procHeight - size) / 2;
      maxX = minX + size;
      maxY = minY + size;
    } else {
      // Segment using TFJS
      const segmentationResult = await this.segmenter.segmentPeople(procCanvas, {
        multiSegmentation: false,
        segmentBodyParts: false
      });

      const imageData = procCtx.getImageData(0, 0, procWidth, procHeight);
      const data = imageData.data;
      
      let foundPixels = false;

      if (segmentationResult.length > 0) {
        const maskData = await segmentationResult[0].mask.toImageData();
        const maskArray = maskData.data;

        for (let y = 0; y < procHeight; y++) {
          for (let x = 0; x < procWidth; x++) {
            const index = (y * procWidth + x) * 4;
            // maskArray usually stores confidence or binary in A channel, or R channel
            // In body-segmentation TFJS, it returns ImageData where alpha channel or R/G/B channel > 0 for foreground.
            const isForeground = maskArray[index + 3] > 128 || maskArray[index] > 128;

            if (!isForeground) {
              data[index + 3] = 0; // Transparent background
            } else {
              foundPixels = true;
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
      }

      if (!foundPixels) {
        console.warn("No face/hair found in the image.");
        const size = Math.min(procWidth, procHeight);
        minX = (procWidth - size) / 2;
        minY = (procHeight - size) / 2;
        maxX = minX + size;
        maxY = minY + size;
      } else {
        procCtx.putImageData(imageData, 0, 0);
        const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(procWidth, maxX + padding);
        maxY = Math.min(procHeight, maxY + padding);
      }
    }

    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;

    const maxDim = Math.max(faceWidth, faceHeight);
    const centerX = minX + faceWidth / 2;
    const centerY = minY + faceHeight / 2;
    
    let finalX = Math.max(0, centerX - maxDim / 2);
    let finalY = Math.max(0, centerY - maxDim / 2);
    let finalSize = maxDim;

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
