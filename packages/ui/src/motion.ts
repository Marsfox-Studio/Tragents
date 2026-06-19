export const SPRINGS = {
  snappy: { type: 'spring', stiffness: 380, damping: 28, mass: 1 },
  smooth: { type: 'spring', stiffness: 220, damping: 26, mass: 1 },
  soft: { type: 'spring', stiffness: 140, damping: 22, mass: 1 },
  tight: { type: 'spring', stiffness: 500, damping: 32, mass: 0.9 },
} as const;

export const EASES = {
  appleStandard: [0.4, 0, 0.2, 1],
  appleDecel: [0.05, 0.7, 0.1, 1],
  appleAccel: [0.3, 0, 0.8, 0.15],
} as const;

export const DURATIONS = {
  instant: 0.08,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  glacial: 0.8,
} as const;
