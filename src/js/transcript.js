/**
 * SignBridge — Transcript Manager
 * Smoothing, debouncing, display, and text-to-speech
 */

// DOM references (set during init)
let els = {};

// State
let fullText = '';
let currentWord = '';
let letterBuffer = [];
let holdingLetter = '';
let holdCount = 0;
let lastConfirmedLetter = '';
let noHandFrames = 0;

// Tuning constants
const BUFFER_SIZE = 12;    // Number of frames to average over
const HOLD_THRESHOLD = 18; // Frames of same letter needed to confirm
const NO_HAND_TIMEOUT = 30; // Frames without hand before resetting indicators
const NO_HAND_SPACE_FRAMES = 45; // Frames without hand before auto-inserting a space

/**
 * Initialize with DOM element references
 */
export function initTranscript(elements) {
  els = elements;
  buildReferenceStrip();
}

/**
 * Build the A-Z reference strip at the bottom
 */
function buildReferenceStrip() {
  if (!els.aslStrip) return;
  els.aslStrip.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .map((l) => `<div class="ref-letter" data-letter="${l}">${l}</div>`)
    .join('');
}

/**
 * Process one frame's classification result
 * Called every frame from app.js
 */
export function processFrame(result) {
  // No hand detected
  if (!result) {
    noHandFrames++;
    if (noHandFrames > NO_HAND_TIMEOUT) {
      els.currentLetter?.classList.remove('active');
      updateConfidence(0);
      highlightRefLetter(null);
    }
    // Insert a space after a sustained no-hand gap when building a word.
    if (noHandFrames === NO_HAND_SPACE_FRAMES && currentWord.length > 0) {
      confirmLetter(' ');
    }
    return;
  }

  noHandFrames = 0;
  const { letter, confidence } = result;

  // Update visual indicators
  updateConfidence(confidence);
  if (letter && letter !== ' ') {
    highlightRefLetter(letter);
    els.currentLetter.textContent = letter;
    els.currentLetter.classList.add('active');
  } else if (letter === ' ') {
    highlightRefLetter(null);
    els.currentLetter.textContent = '␣';
    els.currentLetter.classList.add('active');
  }

  // Add to smoothing buffer
  letterBuffer.push(letter);
  if (letterBuffer.length > BUFFER_SIZE) {
    letterBuffer.shift();
  }

  // Get the most frequent letter in the buffer
  const mode = getBufferMode();
  if (!mode) return;

  // Hold detection — same letter held for N frames = confirmed
  if (mode === holdingLetter) {
    holdCount++;
  } else {
    holdingLetter = mode;
    holdCount = 1;
  }

  // Show preview of what's being held
  if (holdCount > 5 && holdCount < HOLD_THRESHOLD && holdingLetter !== ' ') {
    els.currentWord.textContent = currentWord + holdingLetter + '…';
  }

  // Confirm the letter
  if (holdCount === HOLD_THRESHOLD) {
    confirmLetter(holdingLetter);
    // Prevent re-triggering until the user changes their hand shape
    holdCount = HOLD_THRESHOLD + 999;
  }
}

/**
 * Find the most common letter in the buffer
 * Must appear in at least 50% of frames
 */
function getBufferMode() {
  if (letterBuffer.length < 5) return null;

  const counts = {};
  for (const l of letterBuffer) {
    if (l != null) counts[l] = (counts[l] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= letterBuffer.length * 0.5) {
    return sorted[0][0];
  }
  return null;
}

/**
 * A letter has been held long enough — add it to the transcript
 */
function confirmLetter(letter) {
  lastConfirmedLetter = letter;

  if (letter === ' ') {
    // Space gesture — finalize current word
    if (currentWord.length > 0) {
      fullText += currentWord + ' ';
      speakWord(currentWord);
      currentWord = '';
    }
  } else {
    currentWord += letter;
  }

  // Update all displays
  renderTranscript();
  els.currentWord.textContent = currentWord;
  const totalChars = (fullText + currentWord).replace(/\s/g, '').length;
  els.letterCount.textContent = `${totalChars} letter${totalChars !== 1 ? 's' : ''}`;

  // Clear buffer so the same letter isn't immediately re-detected
  letterBuffer = [];
}

/**
 * Render the full transcript to the DOM
 */
function renderTranscript() {
  const text = fullText + currentWord;
  if (text.length === 0) {
    els.transcript.innerHTML =
      '<span class="placeholder">Start signing to see translation here...</span>';
    return;
  }

  els.transcript.innerHTML = text
    .split('')
    .map((c) => {
      if (c === ' ') return '<span class="space"> </span>';
      return `<span class="letter">${c}</span>`;
    })
    .join('');

  // Auto-scroll
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

/**
 * Update the confidence bar width and color
 */
function updateConfidence(confidence) {
  if (!els.confidenceFill) return;
  const pct = Math.round(confidence * 100);
  els.confidenceFill.style.width = `${pct}%`;
  els.confidenceFill.className = 'confidence-fill';
  if (pct > 70) els.confidenceFill.classList.add('high');
  else if (pct > 40) els.confidenceFill.classList.add('medium');
  else els.confidenceFill.classList.add('low');
}

/**
 * Highlight the active letter in the A-Z reference strip
 */
function highlightRefLetter(letter) {
  if (!els.aslStrip) return;
  els.aslStrip.querySelectorAll('.ref-letter').forEach((el) => {
    el.classList.toggle('active', el.dataset.letter === letter);
  });
}

// ============================================
// Text-to-Speech
// ============================================

function speakWord(word) {
  if (!word || !window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(word);
  utt.rate = 0.9;
  utt.pitch = 1;
  speechSynthesis.speak(utt);
}

/**
 * Speak the entire transcript aloud
 */
export function speakFullTranscript() {
  const text = (fullText + currentWord).trim();
  if (!text || !window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.85;
  speechSynthesis.speak(utt);
}

/**
 * Clear everything and reset
 */
export function clearTranscript() {
  fullText = '';
  currentWord = '';
  letterBuffer = [];
  holdCount = 0;
  holdingLetter = '';
  lastConfirmedLetter = '';
  renderTranscript();
  els.currentWord.textContent = '';
  els.letterCount.textContent = '0 letters';
  els.currentLetter?.classList.remove('active');
}