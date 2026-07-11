// Turns "how different are these two colors" into the 0-100 score the
// player sees, plus a short verdict line.

import { rgbToLab, deltaE76, type RGB } from './color';

// Fixed scoring scale: how much Lab deltaE distance costs 100 points'
// worth of score. (Previously configurable via a Normal/Hard difficulty
// toggle; Phase 1 now uses one fixed scale for every shot.)
const SCALE = 62;

// Turns a Lab deltaE distance directly into a 0-100 score. Exposed on
// its own so callers that already have a distance (like the best-patch
// scan in lib/bestPatch.ts) don't need a target/shot RGB pair.
export function scoreFromDistance(distance: number): number {
  const rawScore = Math.round(100 * (1 - distance / SCALE));
  return Math.max(0, rawScore);
}

export function scoreMatch(target: RGB, shot: RGB): number {
  const distance = deltaE76(rgbToLab(target), rgbToLab(shot));
  return scoreFromDistance(distance);
}

export function verdictForScore(score: number): string {
  if (score >= 90) return 'Dead on.';
  if (score >= 75) return 'Close match.';
  if (score >= 50) return 'In the neighborhood.';
  if (score >= 25) return 'Not quite.';
  return 'Way off.';
}
