/**
 * SignBridge — Main App Orchestrator
 * Wires together handTracker, classifier, and transcript
 */

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
