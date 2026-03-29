/**
 * SignBridge — Main App Orchestrator
 * Wires together handTracker, classifier, transcript, AI buddy
 */
import { toggleVoice, getCurrentVoice } from './elevenlabs.js';
import { initHandTracker, startCamera } from './handTracker.js';
import { classifyASL } from './classifier.js';
import {
  initTranscript,
  processFrame,
  speakFullTranscript,
  clearTranscript,
  setActiveTab,
  handleSendToBuddy,
  clearChat,
  handleBuddyTypedInput,
} from './transcript.js';
/**
 * Initialize the app — called from main.js
 */
export function initApp() {
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
    // Buddy elements
    chatHistory: document.getElementById('chat-history'),
    buddyCompose: document.getElementById('buddy-compose'),
    buddyCurrentWord: document.getElementById('buddy-current-word'),
    buddyCharCount: document.getElementById('buddy-char-count'),
    sendBuddyBtn: document.getElementById('send-buddy-btn'),
  });

  // Wire up header buttons
  document.getElementById('speak-btn')?.addEventListener('click', speakFullTranscript);
  document.getElementById('clear-btn')?.addEventListener('click', clearTranscript);

  // Wire up tab buttons
  document.querySelectorAll('.panel-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById(`tab-${tabName}`).classList.add('active');
      setActiveTab(tabName);
    });
  });

  // Wire up buddy buttons
  document.getElementById('send-buddy-btn')?.addEventListener('click', handleSendToBuddy);
  document.getElementById('clear-chat-btn')?.addEventListener('click', clearChat);

  // Voice toggle button
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  voiceToggleBtn?.addEventListener('click', () => {
    const newVoice = toggleVoice();
    const label = newVoice === 'female' ? 'Female' : 'Male';
    voiceToggleBtn.title = `Switch voice: ${label}`;
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

  // ============================================
  // START BUTTON
  // ============================================
  startBtn.addEventListener('click', async () => {
    startBtn.innerHTML = '<span class="spinner"></span> Loading AI model…';
    startBtn.disabled = true;

    try {
      statusEl.textContent = 'Downloading hand tracking model…';
      await initHandTracker(video, overlay, onHandResults);

      statusEl.textContent = 'Starting camera…';
      await startCamera();

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

  const cameraContainer = document.getElementById('camera-container');

  // ============================================
  // Frame-by-frame callback
  // ============================================
  function onHandResults(landmarks, handedness) {
    if (landmarks) {
      const result = classifyASL(landmarks, handedness);
      processFrame(result);
      cameraContainer?.classList.add('detecting');

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
      processFrame(null);
      cameraContainer?.classList.remove('detecting');
      statusEl.textContent = 'Show your hand to start signing';
      statusEl.classList.remove('active');
    }
  }
  // Typed input for buddy
  const buddyTypeInput = document.getElementById('buddy-type-input');
  buddyTypeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && buddyTypeInput.value.trim()) {
      handleBuddyTypedInput(buddyTypeInput.value.trim());
      buddyTypeInput.value = '';
    }
  });
}