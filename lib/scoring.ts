// Turns "how different are these two colors" into the 0-100 score the
// player sees, plus a short verdict line.

import { rgbToLab, deltaE76, type RGB } from './color';

export type Difficulty = 'normal' | 'hard';

// Hard mode divides by a smaller number, so the same color distance
// (deltaE) costs more points — the same miss hurts more.
const SCALE_BY_DIFFICULTY: Record<Difficulty, number> = {
  normal: 62,
  hard: 40,
};

export function scoreMatch(target: RGB, shot: RGB, difficulty: Difficulty): number {
  const distance = deltaE76(rgbToLab(target), rgbToLab(shot));
  const scale = SCALE_BY_DIFFICULTY[difficulty];
  const rawScore = Math.round(100 * (1 - distance / scale));
  return Math.max(0, rawScore);
}

export function verdictForScore(score: number): string {
  if (score >= 90) return 'Dead on.';
  if (score >= 75) return 'Close match.';
  if (score >= 50) return 'In the neighborhood.';
  if (score >= 25) return 'Not quite.';
  return 'Way off.';
}
