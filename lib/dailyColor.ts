// Generates "today's target color" — the same color for every player on
// the same day, without needing a server (yet).

import { hslToRgb, rgbToHex, type RGB } from './color';

export type DailyTarget = {
  hue: number;
  saturation: number;
  lightness: number;
  rgb: RGB;
  hex: string;
};

// Findable-in-the-real-world ranges, per CLAUDE.md: full hue wheel, but
// saturation and lightness kept away from the extremes (no near-white,
// near-black, or near-grey targets).
const HUE_RANGE = [0, 360] as const;
const SATURATION_RANGE = [45, 85] as const;
const LIGHTNESS_RANGE = [42, 64] as const;

// Turns any string into a whole number. The same input string always
// produces the same number — that's what lets us turn "today's date"
// into "today's random seed". Exported so other seeded-by-date features
// (see lib/colorFacts.ts) can reuse the exact same hashing/PRNG instead
// of each rolling their own.
export function hashStringToSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    // `| 0` truncates to a 32-bit integer, keeping the math fast and stable.
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // `>>> 0` makes it unsigned, so it's a positive seed.
}

// A small, fast "pseudo-random number generator" called mulberry32.
// Unlike Math.random(), it's deterministic: the same seed always produces
// the exact same sequence of numbers between 0 and 1.
export function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Formats a date as "YYYY-MM-DD" in local time, so the target changes at
// local midnight for the player.
export function dateToSeedString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomInRange(random: () => number, [min, max]: readonly [number, number]): number {
  return min + random() * (max - min);
}

// The main entry point: pass no argument to get today's target, or pass
// a specific date (handy for testing).
export function getDailyTarget(date: Date = new Date()): DailyTarget {
  const seed = hashStringToSeed(dateToSeedString(date));
  const random = mulberry32(seed);

  const hue = randomInRange(random, HUE_RANGE);
  const saturation = randomInRange(random, SATURATION_RANGE);
  const lightness = randomInRange(random, LIGHTNESS_RANGE);
  const rgb = hslToRgb(hue, saturation, lightness);

  return { hue, saturation, lightness, rgb, hex: rgbToHex(rgb) };
}
