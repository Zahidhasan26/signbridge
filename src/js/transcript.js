/**
 * SignBridge — Transcript Manager
 * Smoothing, debouncing, display, TTS, and AI Buddy compose routing
 */

import { speakWord as elevenLabsSpeak, speakFull } from './elevenlabs.js';
import { askAIBuddy, clearConversationHistory } from './ai.js';

// DOM references (set during init)
let els = {};

// ============================================
// SHARED STATE
// ============================================
let currentTab = 'translation'; // 'translation' or 'buddy'
let letterBuffer = [];
let holdingLetter = '';
let holdCount = 0;
let noHandFrames = 0;

// ============================================
// TRANSLATION TAB STATE
// ============================================
let fullText = '';
let currentWord = '';
let lastConfirmedLetter = '';

// ============================================
// BUDDY TAB STATE
// ============================================
let buddyFullText = '';
let buddyCurrentWord = '';
let isBuddyThinking = false;

// Tuning constants
const BUFFER_SIZE = 12;
const HOLD_THRESHOLD = 18;
const NO_HAND_TIMEOUT = 30;
const NO_HAND_SPACE_FRAMES = 45;

/**
 * Initialize with DOM element references
 */
export function initTranscript(elements) {
  els = elements;
  buildReferenceStrip();
}

/**
 * Switch active tab
 */
export function setActiveTab(tabName) {
  currentTab = tabName;
  // Reset detection state when switching tabs
  letterBuffer = [];
  holdCount = 0;
  holdingLetter = '';
  noHandFrames = 0;
}

/**
 * Build the A-Z reference strip
 */
function buildReferenceStrip() {
  if (!els.aslStrip) return;
  els.aslStrip.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .map((l) => `<div class="ref-letter" data-letter="${l}">${l}</div>`)
    .join('');
}

// ============================================
// PROCESS FRAME — routes to active tab
// ============================================

export function processFrame(result) {
  // No hand detected
  if (!result) {
    noHandFrames++;
    if (noHandFrames > NO_HAND_TIMEOUT) {
      els.currentLetter?.classList.remove('active');
      updateConfidence(0);
      highlightRefLetter(null);
    }
    // Auto-space on no hand
    if (noHandFrames === NO_HAND_SPACE_FRAMES) {
      if (currentTab === 'translation' && currentWord.length > 0) {
        confirmLetterTranslation(' ');
      } else if (currentTab === 'buddy' && buddyCurrentWord.length > 0) {
        confirmLetterBuddy(' ');
      }
    }
    return;
  }

  noHandFrames = 0;
  const { letter, confidence } = result;

  // Update shared visual indicators
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

  // Smoothing buffer
  letterBuffer.push(letter);
  if (letterBuffer.length > BUFFER_SIZE) {
    letterBuffer.shift();
  }

  const mode = getBufferMode();
  if (!mode) return;

  // Hold detection
  if (mode === holdingLetter) {
    holdCount++;
  } else {
    holdingLetter = mode;
    holdCount = 1;
  }

  // Preview
  if (holdCount > 5 && holdCount < HOLD_THRESHOLD && holdingLetter !== ' ') {
    if (currentTab === 'translation') {
      els.currentWord.textContent = currentWord + holdingLetter + '…';
    } else {
      els.buddyCurrentWord.textContent = buddyCurrentWord + holdingLetter + '…';
    }
  }

  // Confirm
  if (holdCount === HOLD_THRESHOLD) {
    if (currentTab === 'translation') {
      confirmLetterTranslation(holdingLetter);
    } else {
      confirmLetterBuddy(holdingLetter);
    }
    holdCount = HOLD_THRESHOLD + 999;
  }
}

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

// ============================================
// TRANSLATION TAB — confirm + render
// ============================================

function confirmLetterTranslation(letter) {
  lastConfirmedLetter = letter;

  if (letter === ' ') {
    if (currentWord.length > 0) {
      fullText += currentWord + ' ';
      speakWord(currentWord);
      currentWord = '';
    }
  } else {
    currentWord += letter;
  }

  renderTranscript();
  els.currentWord.textContent = currentWord;
  const totalChars = (fullText + currentWord).replace(/\s/g, '').length;
  els.letterCount.textContent = `${totalChars} letter${totalChars !== 1 ? 's' : ''}`;
  letterBuffer = [];
}

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
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

// ============================================
// BUDDY TAB — confirm + render
// ============================================

function confirmLetterBuddy(letter) {
  if (isBuddyThinking) return; // don't accept input while waiting

  if (letter === ' ') {
    if (buddyCurrentWord.length > 0) {
      buddyFullText += buddyCurrentWord + ' ';
      buddyCurrentWord = '';
    }
  } else {
    buddyCurrentWord += letter;
  }

  renderBuddyCompose();
  els.buddyCurrentWord.textContent = buddyCurrentWord;

  const totalChars = (buddyFullText + buddyCurrentWord).replace(/\s/g, '').length;
  els.buddyCharCount.textContent = `${totalChars} chars`;

  // Enable/disable send button
  const hasText = (buddyFullText + buddyCurrentWord).trim().length > 0;
  els.sendBuddyBtn.disabled = !hasText;

  letterBuffer = [];
}

function renderBuddyCompose() {
  const text = buddyFullText + buddyCurrentWord;
  if (text.length === 0) {
    els.buddyCompose.innerHTML =
      '<span class="placeholder">Start signing to compose a message...</span>';
    return;
  }
  els.buddyCompose.innerHTML = text
    .split('')
    .map((c) => {
      if (c === ' ') return '<span class="space"> </span>';
      return `<span class="letter">${c}</span>`;
    })
    .join('');
}

// ============================================
// SEND TO BUDDY
// ============================================

export async function handleSendToBuddy() {
  const text = (buddyFullText + buddyCurrentWord).trim();
  if (!text || isBuddyThinking) return;

  isBuddyThinking = true;
  els.sendBuddyBtn.disabled = true;

  // Append user bubble
  appendChatBubble(text, 'user');

  // Clear compose
  buddyFullText = '';
  buddyCurrentWord = '';
  renderBuddyCompose();
  els.buddyCurrentWord.textContent = '';
  els.buddyCharCount.textContent = '0 chars';

  // Show thinking indicator
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'ai-thinking';
  thinkingEl.textContent = 'Buddy is thinking…';
  els.chatHistory.appendChild(thinkingEl);
  els.chatHistory.scrollTop = els.chatHistory.scrollHeight;

  // Call Gemini
  const reply = await askAIBuddy(text);

  // Remove thinking indicator
  thinkingEl.remove();

  // Append buddy bubble
  appendChatBubble(reply, 'buddy');

  // Speak the reply
  speakFull(reply);

  isBuddyThinking = false;
}

function appendChatBubble(text, type) {
  // Remove welcome message if present
  const welcome = els.chatHistory.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const bubble = document.createElement('div');
  bubble.className = type === 'user' ? 'chat-user' : 'chat-buddy';
  bubble.textContent = text;
  els.chatHistory.appendChild(bubble);
  els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
}

// ============================================
// CLEAR FUNCTIONS
// ============================================

export function clearChat() {
  // Clear buddy state
  buddyFullText = '';
  buddyCurrentWord = '';
  isBuddyThinking = false;
  renderBuddyCompose();
  els.buddyCurrentWord.textContent = '';
  els.buddyCharCount.textContent = '0 chars';
  els.sendBuddyBtn.disabled = true;

  // Clear chat history
  els.chatHistory.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <p>Hey there! I'm your SignBridge Buddy. Sign a message and hit send — I'd love to chat.</p>
    </div>`;

  // Clear Gemini conversation history
  clearConversationHistory();
}

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

// ============================================
// SHARED VISUAL HELPERS
// ============================================

function updateConfidence(confidence) {
  if (!els.confidenceFill) return;
  const pct = Math.round(confidence * 100);
  els.confidenceFill.style.width = `${pct}%`;
  els.confidenceFill.className = 'confidence-fill';
  if (pct > 70) els.confidenceFill.classList.add('high');
  else if (pct > 40) els.confidenceFill.classList.add('medium');
  else els.confidenceFill.classList.add('low');
}

function highlightRefLetter(letter) {
  if (!els.aslStrip) return;
  els.aslStrip.querySelectorAll('.ref-letter').forEach((el) => {
    el.classList.toggle('active', el.dataset.letter === letter);
  });
}

// ============================================
// TYPED INPUT FOR BUDDY
// ============================================

export function handleBuddyTypedInput(text) {
  if (!text.trim() || isBuddyThinking) return;

  // Set the compose text to what was typed
  buddyFullText = text;
  buddyCurrentWord = '';
  renderBuddyCompose();

  // Then send it
  handleSendToBuddy();
}

// ============================================
// Text-to-Speech
// ============================================

function speakWord(word) {
  if (!word) return;
  elevenLabsSpeak(word);
}

export function speakFullTranscript() {
  const text = (fullText + currentWord).trim();
  if (!text) return;
  speakFull(text);
}