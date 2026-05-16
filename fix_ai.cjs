const fs = require('fs');
let code = fs.readFileSync('src/avatarBuilder.js', 'utf8');

const importOld = 'import { ImageSegmenter, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";';
const importNew = `import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";`;

code = code.replace(importOld, importNew);

const initModelOld = `  async initModel() {
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
      document.getElementById('loading-text').innerText = "Failed to load AI. Using fallback.";
      setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
      }, 1500);
      this.isModelLoading = false;
    }
  }`;

const initModelNew = `  async initModel() {
    try {
      const segmenterConfig = {
        runtime: 'tfjs',
        modelType: 'general'
      };
      this.segmenter = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
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
  }`;

code = code.replace(initModelOld, initModelNew);

const processOld = `      // Segment the scaled image
      const segmentationResult = this.segmenter.segment(procCanvas);
      const mask = segmentationResult.categoryMask; 
      
      const maskArr = mask.getAsUint8Array();
      const maskW = mask.width;
      const maskH = mask.height;

      const imageData = procCtx.getImageData(0, 0, procWidth, procHeight);
      const data = imageData.data;
      
      // Categories: 1: hair, 3: face
      const keepClasses = new Set([1, 3]);

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
      }`;

const processNew = `      // Segment the scaled image using TFJS Body Segmentation
      const segmentation = await this.segmenter.segmentPeople(procCanvas, {
        flipHorizontal: false,
        multiSegmentation: false,
        segmentBodyParts: false,
      });

      const imageData = procCtx.getImageData(0, 0, procWidth, procHeight);
      const data = imageData.data;

      let foundPixels = false;

      if (segmentation.length > 0) {
        const mask = await segmentation[0].mask.toImageData();
        const maskData = mask.data;

        for (let y = 0; y < procHeight; y++) {
          for (let x = 0; x < procWidth; x++) {
            const index = (y * procWidth + x) * 4;
            // The mask imageData has the segmentation mask in the A channel (or R channel depending on model, usually R=G=B=A for probability or 255 for person)
            const isPerson = maskData[index + 3] > 128 || maskData[index] > 128; // fallback checks

            if (!isPerson) {
              data[index + 3] = 0; // Make transparent
            } else {
              foundPixels = true;
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
      }`;

code = code.replace(processOld, processNew);

fs.writeFileSync('src/avatarBuilder.js', code);
console.log('Successfully updated AI logic!');
