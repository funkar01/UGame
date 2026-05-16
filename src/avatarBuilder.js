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
        
        let bodyMinX = procWidth, bodyMaxX = 0, bodyMinY = procHeight, bodyMaxY = 0;

        // Pass 1: Find the full bounding box of the person
        for (let y = 0; y < procHeight; y++) {
          for (let x = 0; x < procWidth; x++) {
            const index = (y * procWidth + x) * 4;
            const isForeground = maskArray[index + 3] > 128 || maskArray[index] > 128;
            if (isForeground) {
              if (x < bodyMinX) bodyMinX = x;
              if (y < bodyMinY) bodyMinY = y;
              if (x > bodyMaxX) bodyMaxX = x;
              if (y > bodyMaxY) bodyMaxY = y;
            }
          }
        }

        // Pass 2: Dynamically find the head width by scanning downwards
        let maxHeadWidth = 10;
        for (let y = bodyMinY; y <= bodyMaxY; y++) {
          // Stop scanning once we've gone down far enough to capture the cheekbones (1.15x current max width)
          if (y > bodyMinY + maxHeadWidth * 1.15) {
            break;
          }
          
          let rowMinX = procWidth, rowMaxX = 0;
          for (let x = bodyMinX; x <= bodyMaxX; x++) {
            const index = (y * procWidth + x) * 4;
            const isForeground = maskArray[index + 3] > 128 || maskArray[index] > 128;
            if (isForeground) {
              if (x < rowMinX) rowMinX = x;
              if (x > rowMaxX) rowMaxX = x;
            }
          }
          
          if (rowMinX <= rowMaxX) {
            const rowWidth = rowMaxX - rowMinX;
            if (rowWidth > maxHeadWidth) {
              maxHeadWidth = rowWidth;
            }
          }
        }

        // 1.45 is the optimal ratio to ensure the chin is included but neck is chopped
        const chinCutoffY = bodyMinY + maxHeadWidth * 1.45;

        // Pass 3: Apply the mask, crop out the body, and laterally erode to remove background halo borders
        for (let y = 0; y < procHeight; y++) {
          let rowFirstX = -1;
          let rowLastX = -1;
          // First, find the horizontal bounds of the foreground on this specific row
          for (let x = 0; x < procWidth; x++) {
            const index = (y * procWidth + x) * 4;
            const isForeground = maskArray[index + 3] > 128 || maskArray[index] > 128;
            if (isForeground && y <= chinCutoffY) {
              if (rowFirstX === -1) rowFirstX = x;
              rowLastX = x;
            }
          }
          
          // Calculate how many pixels to shave off the left and right to remove the background "border"
          let trimAmount = 0;
          if (rowFirstX !== -1) {
            trimAmount = Math.max(1, Math.floor((rowLastX - rowFirstX) * 0.05));
          }

          for (let x = 0; x < procWidth; x++) {
            const index = (y * procWidth + x) * 4;
            let isForeground = maskArray[index + 3] > 128 || maskArray[index] > 128;

            if (y > chinCutoffY) {
              isForeground = false; // Chop off the neck and shoulders
            }

            // Erode edges to remove background bleeding
            if (isForeground && rowFirstX !== -1) {
              if (x < rowFirstX + trimAmount || x > rowLastX - trimAmount) {
                isForeground = false;
              }
            }

            if (!isForeground) {
              data[index] = 0;     // Red
              data[index + 1] = 0; // Green
              data[index + 2] = 0; // Blue
              data[index + 3] = 0; // Transparent alpha
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
        // Removed the extra padding so we get a tight extraction with no border artifacts.
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
