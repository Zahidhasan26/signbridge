/**
 * SignBridge — Main App Orchestrator
 * Wires together handTracker, classifier, and transcript
 */
import { toggleVoice, getCurrentVoice } from './elevenlabs.js';
import { initHandTracker, startCamera } from './handTracker.js';
import { classifyASL } from './classifier.js';
import {
  initTranscript,
  processFrame,
  speakFullTranscript,
  clearTranscript,
} from './transcript.js';

/**
 * Initialize the app — called from main.js
 */
export function initApp() {
  // Grab DOM references
  const landing = document.getElementById('landing');
  const app = document.getElementById('app');
  const startBtn = document.getElementById('start-btn');
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const statusEl = document.getElementById('status');

  // Initialize transcript module with its DOM elements
  initTranscript({
    transcript: document.getElementById('transcript'),
    currentWord: document.getElementById('current-word'),
    letterCount: document.getElementById('letter-count'),
    currentLetter: document.getElementById('current-letter'),
    confidenceFill: document.getElementById('confidence-fill'),
    aslStrip: document.getElementById('asl-strip'),
  });

  // Wire up header buttons
  document.getElementById('speak-btn')?.addEventListener('click', speakFullTranscript);
  document.getElementById('clear-btn')?.addEventListener('click', clearTranscript);

  // ============================================
  // START BUTTON — the main entry point
  // ============================================
  startBtn.addEventListener('click', async () => {
    startBtn.innerHTML = '<span class="spinner"></span> Loading AI model…';
    startBtn.disabled = true;

    try {
      // Step 1: Load MediaPipe model
      statusEl.textContent = 'Downloading hand tracking model…';
      await initHandTracker(video, overlay, onHandResults);

      // Step 2: Start webcam
      statusEl.textContent = 'Starting camera…';
      await startCamera();

      // Step 3: Switch to app view
      landing.classList.add('hidden');
      app.classList.remove('hidden');

      statusEl.textContent = 'Show your hand to start signing';
      statusEl.classList.add('active');
    } catch (err) {
      console.error('Failed to start:', err);
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.classList.add('error');
      startBtn.textContent = 'Failed — check camera permissions and try again';
      startBtn.disabled = false;
    }
  });

  // Camera container for glow effect
  const cameraContainer = document.getElementById('camera-container');

  // ============================================
  // Frame-by-frame callback from handTracker
  // ============================================
  function onHandResults(landmarks, handedness) {
    if (landmarks) {
      // Classify the hand pose
      const result = classifyASL(landmarks, handedness);

      // Send to transcript manager for smoothing + display
      processFrame(result);

      // Glow effect on camera when detecting
      cameraContainer?.classList.add('detecting');

      // Update status bar
      if (result) {
        const conf = Math.round(result.confidence * 100);
        const display = result.letter === ' ' ? 'SPACE' : result.letter;
        statusEl.textContent = `Detected: ${display} (${conf}%)`;
      } else {
        statusEl.textContent = 'Hand detected — analyzing gesture…';
      }
      statusEl.classList.add('active');
      statusEl.classList.remove('error');
    } else {
      // No hand in frame
      processFrame(null);
      cameraContainer?.classList.remove('detecting');
      statusEl.textContent = 'Show your hand to start signing';
      statusEl.classList.remove('active');
    }
  }
}
// Voice toggle button
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  voiceToggleBtn?.addEventListener('click', () => {
    const newVoice = toggleVoice();
    const label = newVoice === 'female' ? 'Female' : 'Male';
    voiceToggleBtn.title = `Switch voice: ${label}`;
    // Swap icon to indicate gender
    if (newVoice === 'male') {
      voiceToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
          <line x1="15" y1="3" x2="21" y2="3"/>
          <line x1="18" y1="0" x2="18" y2="6"/>
        </svg>`;
    } else {
      voiceToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>`;
    }
  });