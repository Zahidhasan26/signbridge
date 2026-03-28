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

  // ============================
  // 5 FINGERS EXTENDED
  // ============================

  if (f.count === 5 && f.thumb && f.index && f.middle && f.ring && f.pinky) {
    // Open hand = SPACE gesture
    return { letter: ' ', confidence: 0.7 };
  }

  // ============================
  // 4 FINGERS EXTENDED
  // ============================

  // B — 4 fingers up, thumb tucked across palm
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

    // --- E: All fingertips curled tightly toward palm, thumb tucked across/below them ---
    // E has fingertips touching or very close to the palm, thumb tip below fingers
    const indexCurl = fingerAngle(landmarks, FINGER.INDEX);
    const middleCurl = fingerAngle(landmarks, FINGER.MIDDLE);
    const ringCurl = fingerAngle(landmarks, FINGER.RING);
    const pinkyCurl = fingerAngle(landmarks, FINGER.PINKY);
    
    const allTightlyCurled = indexCurl < 80 && middleCurl < 80 && ringCurl < 80 && pinkyCurl < 80;
    
    // E: fingertips are close to thumb tip (tips curled down to meet thumb)
    const avgTipToThumb = (
      distance(thumbTip, indexTip) +
      distance(thumbTip, middleTip) +
      distance(thumbTip, ringTip)
    ) / 3;
    
    if (allTightlyCurled && avgTipToThumb < palmSize * 0.35) {
      return { letter: 'E', confidence: 0.6 };
    }

    // --- T: Thumb pokes UP between index and middle finger ---
    // Thumb tip is between index PIP and middle PIP, and thumb tip is ABOVE (lower y) the index tip
    const thumbToIndexPip = distance(thumbTip, indexPip);
    const thumbToMiddlePip = distance(thumbTip, middlePip);
    const thumbBetween = thumbToIndexPip < palmSize * 0.3 && thumbToMiddlePip < palmSize * 0.35;
    // For T, the thumb tip should be higher (lower y) than the curled index fingertip
    const thumbAboveIndexTip = thumbTip.y < indexTip.y;
    
    if (thumbBetween && thumbAboveIndexTip) {
      return { letter: 'T', confidence: 0.55 };
    }

    // --- M: Three fingers (index, middle, ring) draped over thumb ---
    // All three fingertips are below (higher y) the thumb tip
    const indexOver = indexTip.y > thumbTip.y;
    const middleOver = middleTip.y > thumbTip.y;
    const ringOver = ringTip.y > thumbTip.y;
    
    // M: thumb tip is tucked under and visible between ring and pinky
    if (indexOver && middleOver && ringOver) {
      return { letter: 'M', confidence: 0.5 };
    }

    // --- N: Two fingers (index, middle) draped over thumb ---
    if (indexOver && middleOver && !ringOver) {
      return { letter: 'N', confidence: 0.5 };
    }

    // --- S: Fist with thumb wrapped ACROSS the front of fingers ---
    // Thumb tip is near the index/middle PIP area but NOT poking between them
    // Key difference from A: thumb is in front of fingers, not to the side
    const thumbNearFront = (
      distance(thumbTip, indexPip) < palmSize * 0.45 ||
      distance(thumbTip, middlePip) < palmSize * 0.45
    );
    // Thumb tip should be roughly between index MCP and middle MCP horizontally
    const thumbCenterX = (indexMcp.x + middleMcp.x) / 2;
    const thumbNearCenter = Math.abs(thumbTip.x - thumbCenterX) < palmSize * 0.3;
    
    if (thumbNearFront && thumbNearCenter && !isThumbOut(landmarks)) {
      return { letter: 'S', confidence: 0.6 };
    }

    // --- A: Fist with thumb to the SIDE (alongside the index finger) ---
    return { letter: 'A', confidence: 0.55 };
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

  // ============================
  // DYNAMIC LETTERS (simplified)
  // J = I with a downward motion → just map to I for static detection
  // Z = index draws Z → just map to D/index for static detection
  // ============================

  return null; // Unrecognized
}