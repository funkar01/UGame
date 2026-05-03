import { AvatarBuilder } from './avatarBuilder.js';
import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
  const actionButtons = document.getElementById('action-buttons');
  const cameraContainer = document.getElementById('camera-container');
  const previewSection = document.getElementById('preview-section');
  
  const btnCamera = document.getElementById('btn-camera');
  const fileUpload = document.getElementById('file-upload');
  const btnTakePhoto = document.getElementById('btn-take-photo');
  const btnRetake = document.getElementById('btn-retake');
  const btnNext = document.getElementById('btn-next');
  const btnStartGame = document.getElementById('btn-start-game');
  
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

  btnNext.addEventListener('click', () => {
    previewSection.classList.add('hidden');
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

    // Transition to game
    startScreen.classList.add('fade-out');
    
    setTimeout(() => {
      startScreen.classList.add('hidden');
      gameContainer.classList.remove('hidden');
      
      // Initialize game
      const gameCanvas = document.getElementById('game-canvas');
      gameInstance = new Game(gameCanvas, avatarDataUrl, selectedTeam);
      gameInstance.start();
    }, 500);
  });
});
