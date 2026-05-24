import { AvatarBuilder } from './avatarBuilder.js';
import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
  // Request permissions at startup
  const requestPermissionsFirst = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');

      if (hasVideo) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Camera permission rejected or unavailable on startup:", e);
        }
      }

      if (hasAudio) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Audio permission rejected or unavailable on startup:", e);
        }
      }
    } catch (err) {
      console.warn("Failed checking or requesting permissions at startup:", err);
    }
  };

  requestPermissionsFirst();

  const actionButtons = document.getElementById('action-buttons');
  const cameraContainer = document.getElementById('camera-container');
  const previewSection = document.getElementById('preview-section');
  
  const btnCamera = document.getElementById('btn-camera');
  const fileUpload = document.getElementById('file-upload');
  const btnTakePhoto = document.getElementById('btn-take-photo');
  const btnRetake = document.getElementById('btn-retake');
  const btnNext = document.getElementById('btn-next');
  const btnStartGame = document.getElementById('btn-start-game');
  const inputRoomId = document.getElementById('room-id');
  
  const btnTeamRed = document.getElementById('btn-team-red');
  const btnTeamBlue = document.getElementById('btn-team-blue');
  const modeSection = document.getElementById('mode-section');
  
  let selectedTeam = null;
  
  const videoElement = document.getElementById('camera-video');
  const previewCanvas = document.getElementById('face-preview');
  
  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');
  
  const builder = new AvatarBuilder(videoElement, previewCanvas);
  
  let gameInstance = null;

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    document.getElementById('mobile-instructions').classList.remove('hidden');
    const pcInstructions = document.getElementById('pc-instructions');
    if (pcInstructions) pcInstructions.classList.add('hidden');
  }

  btnCamera.addEventListener('click', async () => {
    actionButtons.classList.add('hidden');
    cameraContainer.classList.remove('hidden');
    const success = await builder.startCamera();
    if (!success) {
      // fallback
      cameraContainer.classList.add('hidden');
      actionButtons.classList.remove('hidden');
    }
  });

  btnTakePhoto.addEventListener('click', async () => {
    btnTakePhoto.disabled = true;
    const originalText = btnTakePhoto.innerText;
    btnTakePhoto.innerText = "Processing...";
    
    const dataUrl = await builder.captureFaceFromVideo();
    
    btnTakePhoto.disabled = false;
    btnTakePhoto.innerText = originalText;
    
    if (dataUrl) {
      builder.stopCamera();
      cameraContainer.classList.add('hidden');
      previewSection.classList.remove('hidden');
    }
  });

  fileUpload.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      actionButtons.classList.add('hidden');
      await builder.handleFileUpload(e.target.files[0]);
      previewSection.classList.remove('hidden');
    }
  });

  btnRetake.addEventListener('click', () => {
    previewSection.classList.add('hidden');
    modeSection.classList.add('hidden');
    actionButtons.classList.remove('hidden');
    fileUpload.value = ''; // reset file input
  });

  const audioSection = document.getElementById('audio-section');
  const btnRecordAudio = document.getElementById('btn-record-audio');
  const audioPreview = document.getElementById('audio-preview');
  const btnAudioNext = document.getElementById('btn-audio-next');
  const btnAudioSkip = document.getElementById('btn-audio-skip');
  
  // Custom UI elements
  const audioInstruction = document.getElementById('audio-instruction');
  const recorderPulse = document.getElementById('recorder-pulse');
  const recordingProgressContainer = document.getElementById('recording-progress-container');
  const recordingProgressFill = document.getElementById('recording-progress-fill');
  const recordingTimer = document.getElementById('recording-timer');

  let mediaStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let customAudioUrl = null;
  let customAudioBase64 = null;
  let isRecording = false;
  let recordingInterval = null;
  let recordingStartTime = 0;
  const maxRecordingDuration = 2000; // 2 seconds

  const releaseMicrophone = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    mediaRecorder = null;
  };

  const prewarmMicrophone = async () => {
    if (mediaStream) return;
    
    btnRecordAudio.disabled = true;
    if (audioInstruction) audioInstruction.innerText = "Initializing microphone...";
    btnRecordAudio.innerText = "⏳";
    
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(mediaStream);
      
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const mimeType = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        customAudioUrl = URL.createObjectURL(audioBlob);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          customAudioBase64 = reader.result;
        };
        reader.readAsDataURL(audioBlob);

        audioPreview.src = customAudioUrl;
        audioPreview.classList.remove('hidden');
        
        btnRecordAudio.innerText = "🎤";
        btnRecordAudio.classList.remove('recording');
        if (recorderPulse) recorderPulse.classList.remove('active');
        if (audioInstruction) audioInstruction.innerText = "Tap button to record again!";
        if (recordingProgressContainer) recordingProgressContainer.classList.add('hidden');
      };
      
      btnRecordAudio.disabled = false;
      btnRecordAudio.innerText = "🎤";
      if (audioInstruction) audioInstruction.innerText = "Tap button to start recording!";
    } catch (err) {
      console.error("Mic warming error:", err);
      if (audioInstruction) audioInstruction.innerText = "Could not access microphone. Tap skip to continue.";
      btnRecordAudio.disabled = true;
      btnRecordAudio.innerText = "❌";
    }
  };

  btnNext.addEventListener('click', async () => {
    previewSection.classList.add('hidden');
    audioSection.classList.remove('hidden');
    await prewarmMicrophone();
  });

  const startRecording = () => {
    if (!mediaRecorder || isRecording) return;
    
    isRecording = true;
    audioChunks = [];
    audioPreview.classList.add('hidden');
    btnRecordAudio.classList.add('recording');
    btnRecordAudio.innerText = "⏹️";
    if (recorderPulse) recorderPulse.classList.add('active');
    if (audioInstruction) audioInstruction.innerText = "Recording... Tap button to stop";
    
    if (recordingProgressContainer) {
      recordingProgressContainer.classList.remove('hidden');
      recordingProgressFill.style.width = "0%";
      recordingTimer.innerText = "0.0s / 2.0s";
    }
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    recordingInterval = setInterval(() => {
      const elapsed = Date.now() - recordingStartTime;
      const progress = Math.min((elapsed / maxRecordingDuration) * 100, 100);
      if (recordingProgressFill) {
        recordingProgressFill.style.width = `${progress}%`;
      }
      if (recordingTimer) {
        recordingTimer.innerText = `${(elapsed / 1000).toFixed(1)}s / 2.0s`;
      }
      
      if (elapsed >= maxRecordingDuration) {
        stopRecording();
      }
    }, 50);
  };

  const stopRecording = () => {
    if (!isRecording) return;
    isRecording = false;
    
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  };

  btnRecordAudio.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  btnAudioNext.addEventListener('click', () => {
    releaseMicrophone();
    audioSection.classList.add('hidden');
    modeSection.classList.remove('hidden');
  });

  btnAudioSkip.addEventListener('click', () => {
    releaseMicrophone();
    customAudioUrl = null;
    customAudioBase64 = null;
    audioSection.classList.add('hidden');
    modeSection.classList.remove('hidden');
  });

  btnTeamRed.addEventListener('click', () => {
    selectedTeam = 'red';
    btnTeamRed.style.border = '2px solid white';
    btnTeamBlue.style.border = '2px solid transparent';
    btnStartGame.classList.remove('hidden');
  });

  btnTeamBlue.addEventListener('click', () => {
    selectedTeam = 'blue';
    btnTeamBlue.style.border = '2px solid white';
    btnTeamRed.style.border = '2px solid transparent';
    btnStartGame.classList.remove('hidden');
  });

  btnStartGame.addEventListener('click', () => {
    const avatarDataUrl = builder.getAvatarDataUrl();
    if (!avatarDataUrl || !selectedTeam) return;

    if (isTouchDevice) {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().then(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(e => console.log('Orientation lock failed', e));
            }
          }).catch(e => console.log('Fullscreen request failed', e));
        }
      } catch(e) {
        console.log('Fullscreen/Orientation API not supported', e);
      }
    }

    // Transition to game
    startScreen.classList.add('fade-out');
    
    setTimeout(() => {
      startScreen.classList.add('hidden');
      gameContainer.classList.remove('hidden');
      
      // Initialize game
      const gameCanvas = document.getElementById('game-canvas');
      const roomId = inputRoomId ? inputRoomId.value.trim() : '';
      gameInstance = new Game(gameCanvas, avatarDataUrl, selectedTeam, customAudioBase64, roomId);
      gameInstance.start();

      if (isTouchDevice) {
        document.getElementById('mobile-gamepad').classList.remove('hidden');
      }

      const emojiBar = document.getElementById('emoji-bar');
      if (emojiBar) emojiBar.classList.remove('hidden');
    }, 500);
  });

  // Game Over overlay buttons
  const btnRestart = document.getElementById('btn-restart');
  const btnQuit = document.getElementById('btn-quit');

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (gameInstance) {
        gameInstance.rematch();
      }
    });
  }

  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      document.getElementById('game-over-overlay').classList.add('hidden');
      gameContainer.classList.add('hidden');
      startScreen.classList.remove('hidden');
      startScreen.classList.remove('fade-out');
      
      const emojiBar = document.getElementById('emoji-bar');
      if (emojiBar) emojiBar.classList.add('hidden');
      
      // Reset team selection
      selectedTeam = null;
      btnTeamRed.style.border = '2px solid transparent';
      btnTeamBlue.style.border = '2px solid transparent';
      btnStartGame.classList.add('hidden');
      
      // Full UI Reset to Start Page
      actionButtons.classList.remove('hidden');
      cameraContainer.classList.add('hidden');
      previewSection.classList.add('hidden');
      audioSection.classList.add('hidden');
      modeSection.classList.add('hidden');
      customAudioUrl = null;
      customAudioBase64 = null;
      fileUpload.value = '';
      if (isRecording) stopRecording();
      releaseMicrophone();
      
      if (gameInstance) {
        gameInstance.isRunning = false;
        // stop audio
        if (window.audio && window.audio.stopBGM) window.audio.stopBGM();
        gameInstance = null;
      }
    });
  }

  // Emoji button click listeners
  const emojiButtons = document.querySelectorAll('.emoji-btn');
  emojiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameInstance) {
        const emoji = btn.getAttribute('data-emoji');
        gameInstance.expressLocalEmotion(emoji);
      }
    });
  });
});
