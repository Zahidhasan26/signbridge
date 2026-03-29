/**
 * SignBridge — ASL Classifier (Full A-Z)
 * Distance-based classification: landmarks → ASL letter
 *
 * Landmark reference:
 * 0=Wrist, 1-4=Thumb(CMC,MCP,IP,TIP), 5-8=Index(MCP,PIP,DIP,TIP),
 * 9-12=Middle(MCP,PIP,DIP,TIP), 13-16=Ring(MCP,PIP,DIP,TIP),
 * 17-20=Pinky(MCP,PIP,DIP,TIP)
 */

import { distance, distance2D, angleBetween, FINGER, WRIST } from './utils.js';


// wrist motion history for dynamic gestures
let wristXHistory = [];
const HISTORY_LENGTH = 15; 

// ============================================
// FINGER STATE HELPERS
// ============================================

/**
 * Check if a non-thumb finger is extended (straight out)
 */
function isExtended(landmarks, finger) {
  const tip = landmarks[finger.tip];
  const dip = landmarks[finger.dip];
  const pip = landmarks[finger.pip];
  const mcp = landmarks[finger.mcp];
  const wrist = landmarks[WRIST];

  const tipToWrist = distance(tip, wrist);
  const pipToWrist = distance(pip, wrist);
  const tipToMcp = distance(tip, mcp);
  const pipToMcp = distance(pip, mcp);

  return tipToWrist > pipToWrist && tipToMcp > pipToMcp * 0.8;
}

/**
 * Check if a finger is curled (bent at the joints but not fully closed into fist)
 * Curled = tip is close to MCP area, PIP angle is moderate
 */
function isCurled(landmarks, finger) {
  const tip = landmarks[finger.tip];
  const pip = landmarks[finger.pip];
  const mcp = landmarks[finger.mcp];

  const angle = angleBetween(tip, pip, mcp);
  // Curled fingers have a moderate angle (not straight ~180, not fully closed ~0)
  return angle > 30 && angle < 120;
}

/**
 * Check if thumb is extended outward from the palm
 */
function isThumbOut(landmarks) {
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const indexMcp = landmarks[5];
  const palmCenter = landmarks[9]; // Middle MCP

  const tipToIndex = distance2D(thumbTip, indexMcp);
  const mcpToIndex = distance2D(thumbMcp, indexMcp);

  return tipToIndex > mcpToIndex * 1.1;
}

/**
 * Check if thumb tip is touching or very close to another fingertip
 */
function isThumbTouching(landmarks, fingerTipIndex) {
  const thumbTip = landmarks[4];
  const otherTip = landmarks[fingerTipIndex];
  const palmSize = distance2D(landmarks[0], landmarks[9]); // wrist to middle MCP
  const touchDist = distance(thumbTip, otherTip);

  return touchDist < palmSize * 0.35;
}

/**
 * Check if thumb tip is near a finger's PIP/DIP joint area (tucked under)
 */
function isThumbTucked(landmarks) {
  const thumbTip = landmarks[4];
  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  const palmSize = distance2D(landmarks[0], landmarks[9]);

  const distToIndex = distance(thumbTip, indexPip);
  const distToMiddle = distance(thumbTip, middlePip);

  return Math.min(distToIndex, distToMiddle) < palmSize * 0.45;
}

/**
 * Get finger curl angle at PIP joint (0=fully closed, 180=straight)
 */
function fingerAngle(landmarks, finger) {
  return angleBetween(
    landmarks[finger.tip],
    landmarks[finger.pip],
    landmarks[finger.mcp]
  );
}

/**
 * Check if two fingertips are close together (touching/parallel)
 */
function areTipsTouching(landmarks, tipA, tipB) {
  const palmSize = distance2D(landmarks[0], landmarks[9]);
  return distance(landmarks[tipA], landmarks[tipB]) < palmSize * 0.25;
}

/**
 * Check if two fingertips are spread apart
 */
function areTipsSpread(landmarks, tipA, tipB) {
  const fingerLen = distance2D(landmarks[5], landmarks[8]); // index length approx
  return distance2D(landmarks[tipA], landmarks[tipB]) > fingerLen * 0.3;
}

/**
 * Check if the hand is oriented sideways (index pointing left/right instead of up)
 * by comparing the index fingertip x vs wrist x relative to y difference
 */
function isHandSideways(landmarks) {
  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const dx = Math.abs(indexTip.x - wrist.x);
  const dy = Math.abs(indexTip.y - wrist.y);
  return dx > dy; // More horizontal than vertical
}

/**
 * Check if hand is pointing downward
 */
function isHandPointingDown(landmarks) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  return middleMcp.y > wrist.y; // In screen coords, larger y = lower on screen
}

/**
 * Get all finger states as a summary object
 */
function getStates(landmarks) {
  const index = isExtended(landmarks, FINGER.INDEX);
  const middle = isExtended(landmarks, FINGER.MIDDLE);
  const ring = isExtended(landmarks, FINGER.RING);
  const pinky = isExtended(landmarks, FINGER.PINKY);
  const thumb = isThumbOut(landmarks);
  const count = [thumb, index, middle, ring, pinky].filter(Boolean).length;

  return { thumb, index, middle, ring, pinky, count };
}

// ============================================
// MAIN CLASSIFICATION
// ============================================

/**
 * Classify hand landmarks into an ASL letter
 * Returns { letter: string, confidence: number } or null
 */
export function classifyASL(landmarks, handedness = 'Right') {
  if (!landmarks || landmarks.length < 21) return null;

  const f = getStates(landmarks);
  const sideways = isHandSideways(landmarks);
  const pointingDown = isHandPointingDown(landmarks);
  // Calculate palm size for proportional distance measurements
  const palmSize = distance2D(landmarks[0], landmarks[9]);

 // ============================
  // DYNAMIC GESTURES & VELOCITY
  // ============================

  // 1. TRACK WRIST MOTION
  wristXHistory.push(landmarks[0].x);
  if (wristXHistory.length > HISTORY_LENGTH) {
    wristXHistory.shift();
  }

  // Calculate if the hand is actively moving (prevents mid-swipe false positives)
  let isMoving = false;
  if (wristXHistory.length === HISTORY_LENGTH) {
    const oldestX = wristXHistory[0];
    const newestX = wristXHistory[wristXHistory.length - 1];
    
    // 2. DETECT DYNAMIC SWIPE
    if (f.count >= 4 && Math.abs(oldestX - newestX) > 0.25) { 
      wristXHistory = []; 
      return { letter: '[SWIPE]', confidence: 0.95 };
    }

    // If it moved more than 3% of the screen, consider it "in motion"
    isMoving = Math.abs(oldestX - newestX) > 0.03; 
  }

  // ============================
  // FULL ASL WORDS (Requires hand to be still!)
  // ============================

  // "[Hello]" (The Salute)
  // MUST NOT BE MOVING to prevent triggering during a swipe
  if (f.count >= 4 && !pointingDown && !isMoving) { 
    const wrist = landmarks[0];
    const middleMcp = landmarks[9]; 
    const dx = Math.abs(middleMcp.x - wrist.x);
    const dy = Math.abs(middleMcp.y - wrist.y);
    // Tightened the diagonal angle slightly to be more accurate
    if (dx > dy * 0.6 && dx < dy * 1.3) {
      return { letter: '[Hello]', confidence: 0.85 };
    }
  }

  // "[I Love You]" (ILY)
  if (f.thumb && f.index && !f.middle && !f.ring && f.pinky && !sideways && !pointingDown && !isMoving) {
    return { letter: '[I Love You]', confidence: 0.95 };
  }

  // "[Good]" (Thumbs Up)
  if (f.thumb && !f.index && !f.middle && !f.ring && !f.pinky && !pointingDown && !isMoving) {
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    if (thumbTip.y < indexMcp.y) { 
      return { letter: '[Good]', confidence: 0.90 };
    }
  }

  // "[A Little]" 
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && !isMoving) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const dist = distance(thumbTip, indexTip);
    if (dist < palmSize * 0.4 && dist > palmSize * 0.15) {
      return { letter: '[A Little]', confidence: 0.85 };
    }
  }

  // "[Heart]" (Mini Finger-Heart)
  if (!f.middle && !f.ring && !f.pinky && !isMoving) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    if (distance(thumbTip, indexTip) < palmSize * 0.15 && distance(wrist, indexTip) > palmSize * 1.2) {
      return { letter: '[Heart]', confidence: 0.95 };
    }
  }

  // "[No]" 
  if (!f.ring && !f.pinky && f.count <= 1 && !isMoving) { 
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    if (distance(thumbTip, indexTip) < palmSize * 0.25 && distance(thumbTip, middleTip) < palmSize * 0.25) {
      return { letter: '[No]', confidence: 0.90 };
    }
  }
  // ============================
  // VIP PRIORITY LETTERS ('O' and 'X')
  // Intercept these before U, R, or fists can steal them!
  // ============================

  // 'O' Shape 
  // Thumb touching index and middle, BUT ring finger is slightly further away (prevents 'E' overlap)
  if (f.count <= 1) {
    const thumbTip = landmarks[4];
    const indexTipDist = distance(thumbTip, landmarks[8]);
    const middleTipDist = distance(thumbTip, landmarks[12]);
    const ringTipDist = distance(thumbTip, landmarks[16]); // Check the ring finger!
    
    if (indexTipDist < palmSize * 0.4 && middleTipDist < palmSize * 0.4 && ringTipDist > palmSize * 0.25) {
      return { letter: 'O', confidence: 0.85 };
    }
  }
  // Index is explicitly hooked. Middle is closed.

  // ============================
  // 4 FINGERS EXTENDED
  // ============================

  // B — also matches 4 fingers up with thumb tucked (classic ASL B)
  if (!f.thumb && f.index && f.middle && f.ring && f.pinky && !sideways) {
    if (isThumbTucked(landmarks)) {
      return { letter: 'B', confidence: 0.85 };
    }
  }

  // ============================
  // 3 FINGERS EXTENDED
  // ============================

  // W — index + middle + ring, thumb and pinky closed
  if (!f.thumb && f.index && f.middle && f.ring && !f.pinky) {
    return { letter: 'W', confidence: 0.8 };
  }

  // F — thumb + index touching in circle, middle + ring + pinky extended
  if (!f.index && f.middle && f.ring && f.pinky) {
    if (isThumbTouching(landmarks, 8)) { // thumb touching index tip
      return { letter: 'F', confidence: 0.75 };
    }
  }

  // ============================
  // 2 FINGERS EXTENDED
  // ============================

  if (f.index && f.middle && !f.ring && !f.pinky) {
    // V vs U vs H vs K vs P vs R

    // H — index + middle pointing sideways
    if (sideways && !f.thumb) {
      return { letter: 'H', confidence: 0.7 };
    }

    // P — like K but hand points down
    if (pointingDown && f.thumb) {
      return { letter: 'P', confidence: 0.65 };
    }

    // K — index + middle up, thumb extended between them
    if (f.thumb && !sideways && !pointingDown) {
      // Check if thumb is between index and middle
      const thumbTip = landmarks[4];
      const indexMcp = landmarks[5];
      const middleMcp = landmarks[9];
      const thumbBetween = thumbTip.y < indexMcp.y; // thumb tip is above the knuckles
      if (thumbBetween) {
        return { letter: 'K', confidence: 0.65 };
      }
    }

    // R — index + middle crossed
    if (!f.thumb && !sideways) {
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const indexDip = landmarks[7];
      const middleDip = landmarks[11];
      // Crossed: index tip is on the middle-finger side and vice versa
      // This is tricky — check if the tips have swapped sides relative to their DIPs
      const tipsClose = distance(indexTip, middleTip) < distance(indexDip, middleDip) * 0.7;
      if (tipsClose) {
        return { letter: 'R', confidence: 0.6 };
      }
    }

    // V — peace sign (fingers spread)
    if (!f.thumb && areTipsSpread(landmarks, 8, 12)) {
      return { letter: 'V', confidence: 0.8 };
    }

    // U — index + middle together (fingers close)
    if (!f.thumb) {
      return { letter: 'U', confidence: 0.75 };
    }
  }

  // ============================
  // 1 FINGER EXTENDED
  // ============================

  // ⌫ (BACKSPACE) — Thumbs down (only thumb extended, hand pointing down)
  if (f.thumb && !f.index && !f.middle && !f.ring && !f.pinky && pointingDown) {
    return { letter: '⌫', confidence: 0.85 };
  }

  // D — index only, pointing up
  if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb && !sideways) {
    return { letter: 'D', confidence: 0.75 };
  }

  // G — index + thumb extended, pointing sideways
  if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb && sideways) {
    return { letter: 'G', confidence: 0.7 };
  }

  // Q — like G but pointing down
  if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb && pointingDown) {
    return { letter: 'Q', confidence: 0.65 };
  }

  // L — thumb + index making L shape, others closed
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && !sideways) {
    return { letter: 'L', confidence: 0.8 };
  }

  // I — pinky only
  if (!f.thumb && !f.index && !f.middle && !f.ring && f.pinky) {
    return { letter: 'I', confidence: 0.85 };
  }

  // Y — thumb + pinky (hang loose)
  if (f.thumb && !f.index && !f.middle && !f.ring && f.pinky) {
    return { letter: 'Y', confidence: 0.85 };
  }

  // X — index finger hooked (partially bent)
  if (!f.thumb && !f.middle && !f.ring && !f.pinky) {
    const indexAngle = fingerAngle(landmarks, FINGER.INDEX);
    if (indexAngle > 60 && indexAngle < 140) {
      // Index is bent but not fully closed
      return { letter: 'X', confidence: 0.6 };
    }
  }

  // ============================
  // 0 FINGERS EXTENDED (FIST VARIANTS)
  // ============================

  if (f.count === 0) {
    // All fingers closed — could be A, S, T, M, N, E

    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    const middlePip = landmarks[10];
    const middleMcp = landmarks[9];
    const ringPip = landmarks[14];
    const palmSize = distance2D(landmarks[0], landmarks[9]);

    // --- E: All fingertips curled tightly, tips near thumb ---
    const avgTipToThumb = (
      distance(thumbTip, indexTip) +
      distance(thumbTip, middleTip) +
      distance(thumbTip, ringTip)
    ) / 3;

    if (avgTipToThumb < palmSize * 0.3) {
      return { letter: 'E', confidence: 0.6 };
    }

    // --- T: Thumb pokes up between index and middle ---
    const thumbToIndexPip = distance(thumbTip, indexPip);
    const thumbToMiddlePip = distance(thumbTip, middlePip);
    const thumbBetween = thumbToIndexPip < palmSize * 0.28 && thumbToMiddlePip < palmSize * 0.32;
    const thumbAboveIndexTip = thumbTip.y < indexTip.y;

    if (thumbBetween && thumbAboveIndexTip) {
      return { letter: 'T', confidence: 0.55 };
    }

    // --- A: Thumb sticks out to the SIDE of the fist ---
    // Thumb tip is far from the center of the fingers laterally
    const fingersCenterX = (indexMcp.x + middleMcp.x) / 2;
    const thumbOffsetX = Math.abs(thumbTip.x - fingersCenterX);
    const isThumbToSide = thumbOffsetX > palmSize * 0.35;

    if (isThumbToSide) {
      return { letter: 'A', confidence: 0.6 };
    }

    // --- S: Default fist (thumb across front of fingers) ---
    // This is the most common fist pose and the hardest to distinguish,
    // so we make it the default fallback for closed hands
    return { letter: 'S', confidence: 0.6 };
  }

  // ============================
  // CURVED HAND SHAPES
  // ============================

  // C — all fingers curved (like holding a ball)
  if (f.count >= 3) {
    const indexCurl = fingerAngle(landmarks, FINGER.INDEX);
    const middleCurl = fingerAngle(landmarks, FINGER.MIDDLE);
    const ringCurl = fingerAngle(landmarks, FINGER.RING);
    const pinkyCurl = fingerAngle(landmarks, FINGER.PINKY);

    // All fingers partially curved (angles between 90-160)
    const allCurved = (
      indexCurl > 80 && indexCurl < 160 &&
      middleCurl > 80 && middleCurl < 160 &&
      ringCurl > 80 && ringCurl < 160
    );

    if (allCurved && isThumbOut(landmarks)) {
      return { letter: 'C', confidence: 0.65 };
    }
  }

  // O — all fingertips touching thumb tip (making an O shape)
  if (f.count <= 1) {
    const thumbTip = landmarks[4];
    const palmSize = distance2D(landmarks[0], landmarks[9]);

    const indexTouch = distance(thumbTip, landmarks[8]) < palmSize * 0.3;
    const middleTouch = distance(thumbTip, landmarks[12]) < palmSize * 0.35;

    if (indexTouch && middleTouch) {
      return { letter: 'O', confidence: 0.65 };
    }
  }

  return null; // Unrecognized
}