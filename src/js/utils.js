/**
 * SignBridge — Utility Functions
 * Math helpers for hand landmark analysis
 */

// 3D Euclidean distance between two landmark points
export function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// 2D distance (ignoring depth)
export function distance2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Angle at point B in triangle A-B-C (degrees)
export function angleBetween(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// Landmark index constants
export const WRIST = 0;

export const FINGER = {
  THUMB:  { cmc: 1, mcp: 2, ip: 3, tip: 4 },
  INDEX:  { mcp: 5, pip: 6, dip: 7, tip: 8 },
  MIDDLE: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  RING:   { mcp: 13, pip: 14, dip: 15, tip: 16 },
  PINKY:  { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

// Pairs of landmark indices to draw skeleton lines
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // Index
  [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
  [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
  [5, 9], [9, 13], [13, 17],                // Palm cross
];