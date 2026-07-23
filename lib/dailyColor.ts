// Generates "today's target color" — the same color for every player on
// the same day, without needing a server (yet).
//
// The anti-repeat guard (making sure a day's color isn't too close to the
// last few days') is expensive to check and only needs to run once per
// date, ever — so it doesn't run here at runtime at all. Instead
// scripts/generateDailyColorTable.ts runs it once, offline, for every day
// in a 10-year window after GUARD_EPOCH_DATE, and commits the result to
// assets/dailyColorTable.json. This file just looks a date up in that
// table. See that script (and scripts/dailyColorTableCore.ts, where the
// guard logic itself now lives) for how table entries are produced.

import dailyColorTable from '../assets/dailyColorTable.json';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl, type RGB } from './color';

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
export const HUE_RANGE = [0, 360] as const;
export const SATURATION_RANGE = [45, 85] as const;
export const LIGHTNESS_RANGE = [42, 64] as const;

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

// Builds one candidate color for a given date. `attempt` 0 is the plain
// formula (what a date gets if it's on/before GUARD_EPOCH_DATE, or if it
// falls outside the precomputed table — see getDailyTarget below);
// `attempt` > 0 salts the seed so a different-but-still-deterministic
// color comes out, which is how scripts/dailyColorTableCore.ts nudges a
// date away from recent ones when building the table. Exported so that
// script can reuse the exact same generator rather than duplicating it.
export function baseCandidate(dateStr: string, attempt: number): DailyTarget {
  const seedText = attempt === 0 ? dateStr : `${dateStr}|guard-${attempt}`;
  const seed = hashStringToSeed(seedText);
  const random = mulberry32(seed);

  const hue = randomInRange(random, HUE_RANGE);
  const saturation = randomInRange(random, SATURATION_RANGE);
  const lightness = randomInRange(random, LIGHTNESS_RANGE);
  const rgb = hslToRgb(hue, saturation, lightness);

  return { hue, saturation, lightness, rgb, hex: rgbToHex(rgb) };
}

// The day before the anti-repeat guard shipped. On or before this date,
// getDailyTarget returns the plain formula's result — matching exactly
// what already shipped/was shown, so no already-played day is ever
// rewritten. The precomputed table (and the guard behind it) only covers
// dates after this one.
export const GUARD_EPOCH_DATE = '2026-07-27';

// How far past GUARD_EPOCH_DATE assets/dailyColorTable.json is generated
// to cover. Shared with scripts/generateDailyColorTable.ts so the table
// and the range check below always agree on the same span.
export const TABLE_YEARS = 10;

function computeTableDays(years: number): number {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day + 1); // the first guarded date
  const end = Date.UTC(year + years, month - 1, day + 1); // the same date, `years` later
  // Date.UTC-based (not local Date subtraction) so this is exact calendar
  // day arithmetic, unaffected by daylight-saving shifts in either date.
  return Math.round((end - start) / 86_400_000);
}

export const TABLE_DAYS = computeTableDays(TABLE_YEARS);

// How many calendar days `date` is after the first guarded date — index
// 0 in dailyColorTable.json is that first guarded date, index 1 is the
// day after it, and so on.
function daysSinceFirstGuardedDate(date: Date): number {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  const firstGuardedDateUTC = Date.UTC(year, month - 1, day + 1);
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((dateUTC - firstGuardedDateUTC) / 86_400_000);
}

// Reconstructs a full DailyTarget from just a hex string (all the table
// stores). hexToRgb is exact — rgbToHex already rounded to 8-bit channels
// before the hex was written, so this recovers the identical rgb. hue/
// saturation/lightness are recovered via rgbToHsl, which won't exactly
// match the original float values (see that function's own comment) —
// an imperceptible difference that never changes anything downstream
// (color-family naming, Panel's chrome tint).
function hexToDailyTarget(hex: string): DailyTarget {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb);
  return { hue: h, saturation: s, lightness: l, rgb, hex };
}

// The main entry point: pass no argument to get today's target, or pass
// a specific date (handy for testing).
export function getDailyTarget(date: Date = new Date()): DailyTarget {
  const dateStr = dateToSeedString(date);

  if (dateStr <= GUARD_EPOCH_DATE) {
    return baseCandidate(dateStr, 0);
  }

  const index = daysSinceFirstGuardedDate(date);
  if (index >= 0 && index < dailyColorTable.length) {
    return hexToDailyTarget(dailyColorTable[index]);
  }

  // Only expected if a device's clock is set more than TABLE_YEARS years
  // past GUARD_EPOCH_DATE, or the table simply wasn't regenerated before
  // real "today" caught up to the end of its range — neither is normal,
  // so this is logged loudly (not a quiet fallback) to make either case
  // impossible to miss.
  console.error(
    `[dailyColor] ${dateStr} is outside the precomputed table (covers the ${TABLE_DAYS} days after ${GUARD_EPOCH_DATE}) — falling back to the plain, unguarded formula for this date. Regenerate assets/dailyColorTable.json (see scripts/generateDailyColorTable.ts) to extend coverage.`
  );
  return baseCandidate(dateStr, 0);
}

// Tames today's hue into muted chrome for Panel (see components/Panel.tsx)
// — same hue as the target, but a fixed saturation/lightness that never
// depends on the day's own brightness. That's what keeps every day's tint
// legible: no matter how loud or pale the actual target color is (see
// HUE/SATURATION/LIGHTNESS_RANGE above), the chrome itself is always this
// dark and this muted, so text on top of it stays readable every day.
const CHROME_SATURATION = 35;
const CHROME_BACKGROUND_LIGHTNESS = 10; // close to colors.surface's own depth
const CHROME_BORDER_LIGHTNESS = 20;

export function getDailyAccent(hue: number): { background: string; border: string } {
  return {
    background: rgbToHex(hslToRgb(hue, CHROME_SATURATION, CHROME_BACKGROUND_LIGHTNESS)),
    border: rgbToHex(hslToRgb(hue, CHROME_SATURATION, CHROME_BORDER_LIGHTNESS)),
  };
}
