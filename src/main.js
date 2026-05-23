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
  
  let mediaRecorder;
  let audioChunks = [];
  let customAudioUrl = null;
  let customAudioBase64 = null;

  btnNext.addEventListener('click', () => {
    previewSection.classList.add('hidden');
    audioSection.classList.remove('hidden');
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        customAudioUrl = URL.createObjectURL(audioBlob);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          customAudioBase64 = reader.result;
        };
        reader.readAsDataURL(audioBlob);

        audioPreview.src = customAudioUrl;
        audioPreview.classList.remove('hidden');
        btnRecordAudio.innerText = "🎤 Re-record";
      };
      mediaRecorder.start();
      btnRecordAudio.innerText = "Recording... (Release to stop)";
      btnRecordAudio.style.background = "#ef4444"; // Red for recording
    } catch (err) {
      console.error("Mic error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      btnRecordAudio.style.background = ""; // Reset
    }
  };

  // Touch and mouse events for holding the record button
  btnRecordAudio.addEventListener('mousedown', startRecording);
  btnRecordAudio.addEventListener('mouseup', stopRecording);
  btnRecordAudio.addEventListener('mouseleave', stopRecording);
  btnRecordAudio.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); }, {passive: false});
  btnRecordAudio.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); }, {passive: false});

  btnAudioNext.addEventListener('click', () => {
    audioSection.classList.add('hidden');
    modeSection.classList.remove('hidden');
  });

  btnAudioSkip.addEventListener('click', () => {
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
      if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
      
      if (gameInstance) {
        gameInstance.isRunning = false;
        // stop audio
        if (window.audio && window.audio.stopBGM) window.audio.stopBGM();
        gameInstance = null;
      }
    });
  }
});
