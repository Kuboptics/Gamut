// Finds the best real patch of the target color in a photo, instead of
// just averaging the whole frame. A plain average fails when a small
// target-colored object sits in a mostly different-colored scene: the
// average washes out to some in-between color even though the player
// clearly found the right thing. Scanning many small tiles and ranking
// them by closeness fixes that.

import { rgbToLab, deltaE76, type RGB } from './color';

// The target color must occupy at least this fraction of the frame's
// tiles for the match to count as a real find, not just a few stray
// pixels that happen to be close. Tune here.
export const MIN_COVERAGE = 0.015;

export type BestPatch = {
  color: RGB;
  distance: number;
};

// tileColors is one average color per grid tile, covering the whole
// photo. Ranks every tile by Lab deltaE to the target, then returns the
// tile at the MIN_COVERAGE-th percentile rank (not the single closest
// tile) — so the score reflects a patch big enough to matter, not a
// lucky pixel.
export function findBestPatch(tileColors: RGB[], target: RGB): BestPatch {
  const targetLab = rgbToLab(target);

  const ranked = tileColors
    .map((color) => ({ color, distance: deltaE76(rgbToLab(color), targetLab) }))
    .sort((a, b) => a.distance - b.distance);

  const rankIndex = Math.min(ranked.length - 1, Math.ceil(MIN_COVERAGE * ranked.length) - 1);
  return ranked[rankIndex];
}
