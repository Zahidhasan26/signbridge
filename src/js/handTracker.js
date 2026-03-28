/**
 * SignBridge — Hand Tracker
 * MediaPipe HandLandmarker initialization, webcam, skeleton drawing
 */

import { HAND_CONNECTIONS } from './utils.js';

let handLandmarker = null;
let video = null;
let canvas = null;
let ctx = null;
let isRunning = false;
let onResultsCallback = null;

/**
 * Initialize MediaPipe HandLandmarker
 * This downloads the ML model (~10MB) on first load
 */
export async function initHandTracker(videoEl, canvasEl, onResults) {
  video = videoEl;
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  onResultsCallback = onResults;

  // Dynamic import — MediaPipe loads from CDN
  const vision = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs'
  );

  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  handLandmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  return true;
}

/**
 * Start webcam capture and begin detection loop
 */
export async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
  });
  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });

  // Match canvas dimensions to actual video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  isRunning = true;
  requestAnimationFrame(detectLoop);
}

/**
 * Main detection loop — runs every frame
 */
function detectLoop() {
  if (!isRunning) return;

  const result = handLandmarker.detectForVideo(video, performance.now());

  // Clear the overlay canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (result.landmarks && result.landmarks.length > 0) {
    const landmarks = result.landmarks[0];
    const handedness = result.handednesses?.[0]?.[0]?.categoryName || 'Right';

    drawSkeleton(landmarks);

    if (onResultsCallback) {
      onResultsCallback(landmarks, handedness);
    }
  } else {
    // No hand detected
    if (onResultsCallback) {
      onResultsCallback(null, null);
    }
  }

  requestAnimationFrame(detectLoop);
}

/**
 * Draw the hand skeleton overlay on the canvas
 * Green glowing lines + bright dots on fingertips
 */
function drawSkeleton(landmarks) {
  const w = canvas.width;
  const h = canvas.height;

  // Draw connection lines
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  HAND_CONNECTIONS.forEach(([a, b]) => {
    const ax = landmarks[a].x * w;
    const ay = landmarks[a].y * h;
    const bx = landmarks[b].x * w;
    const by = landmarks[b].y * h;

    // Outer glow line
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = 'rgba(0, 232, 143, 0.2)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner bright line
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = 'rgba(0, 232, 143, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // Draw landmark dots
  const tipIndices = [4, 8, 12, 16, 20];

  landmarks.forEach((point, i) => {
    const x = point.x * w;
    const y = point.y * h;
    const isTip = tipIndices.includes(i);

    // Glow behind fingertips
    if (isTip) {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 232, 143, 0.12)';
      ctx.fill();
    }

    // Main dot
    ctx.beginPath();
    ctx.arc(x, y, isTip ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? '#00e88f' : 'rgba(0, 232, 143, 0.65)';
    ctx.fill();
  });
}

/**
 * Stop everything
 */
export function stopCamera() {
  isRunning = false;
  if (video?.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
}