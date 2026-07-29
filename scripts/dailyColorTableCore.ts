// The anti-repeat guard: checks a candidate color against the last few
// days' and rejects ones that are too close. This only ever needs to run
// once per calendar date, offline — scripts/generateDailyColorTable.ts
// calls generateDailyColorTable() below once to produce
// assets/dailyColorTable.json, which lib/dailyColor.ts reads from at
// runtime. Keeping this here (rather than in lib/dailyColor.ts) is what
// keeps culori — needed for CIEDE2000/OKLCH — out of the app's runtime
// bundle: nothing reachable from app code imports this file.
//
// culori is pinned to an *exact* version in package.json (no ^) on
// purpose: the "table is append-only" test (see
// dailyColorTableCore.test.ts) regenerates the table and asserts it's
// byte-identical to what's committed, which only holds if
// differenceCiede2000/converter produce the exact same output they did
// when assets/dailyColorTable.json was generated. A minor/patch culori
// update could legitimately change CIEDE2000's floating-point output in
// the last decimal places — enough to flip a borderline candidate near a
// threshold and produce a different (still "correct", just different)
// color for that date. If you ever intentionally upgrade culori, expect
// to regenerate the table and review the diff, not just bump the version.
import { converter, differenceCiede2000 } from 'culori';
import { GUARD_EPOCH_DATE, TABLE_DAYS, baseCandidate, dateToSeedString, type DailyTarget } from '../lib/dailyColor';

const LOOKBACK_DAYS = 5;
const MAX_CANDIDATES = 200;

// Perceptual color-distance threshold (CIEDE2000, the standard "how
// different do these two colors actually look" metric). Below this, two
// colors read as too similar to make for a meaningfully different day.
export const MIN_DELTA_E = 25;
// When 200 candidates can't clear MIN_DELTA_E against all of the last
// LOOKBACK_DAYS days, the threshold relaxes in these steps rather than
// looping forever — down to this floor, then an unfiltered fallback.
const DELTA_E_RELAX_STEP = 5;
export const DELTA_E_RELAX_FLOOR = 10;

// On top of the deltaE check, yesterday specifically also needs its hue
// (in OKLCH, a perceptually even hue circle) at least this many degrees
// away — stops two days from reading as "the same color, just lighter/
// darker/more saturated" even when deltaE alone would let it through.
export const MIN_HUE_SEPARATION_FROM_YESTERDAY = 40;

// The variety fix: starting HUE_GUARD_V2_EPOCH, the hue-separation check
// above widens from "just yesterday" to "each of the last
// MIN_HUE_SEPARATION_DAYS days" — a run of 2-3 days that are all
// technically >= MIN_DELTA_E apart but sit in nearby hues (the "everything
// this week reads as blue" complaint) still gets caught this way. Dates
// before the epoch are untouched on purpose, so they regenerate
// byte-identical to what's already committed and may already be playing
// out on a device.
export const HUE_GUARD_V2_EPOCH = '2026-07-30';
export const MIN_HUE_SEPARATION_DAYS = 3;

const toLab = converter('lab');
const toOklch = converter('oklch');
const ciede2000 = differenceCiede2000();

// How different two colors actually look to a human eye.
export function deltaE2000(hexA: string, hexB: string): number {
  // Non-null: every hex passed in here is one we generated ourselves
  // (rgbToHex always produces a valid "#RRGGBB"), so parsing can't fail.
  return ciede2000(toLab(hexA)!, toLab(hexB)!);
}

// Circular hue distance in OKLCH degrees (0-360 wraps around, so the
// distance between 10° and 350° is 20°, not 340°).
export function oklchHueSeparation(hexA: string, hexB: string): number {
  const hueA = toOklch(hexA)?.h ?? 0;
  const hueB = toOklch(hexB)?.h ?? 0;
  const rawDiff = Math.abs(hueA - hueB) % 360;
  return rawDiff > 180 ? 360 - rawDiff : rawDiff;
}

function passesGuard(candidate: DailyTarget, recentDays: DailyTarget[], yesterday: DailyTarget, threshold: number): boolean {
  const farEnoughFromRecentDays = recentDays.every((day) => deltaE2000(candidate.hex, day.hex) >= threshold);
  const hueSeparatedFromYesterday = oklchHueSeparation(candidate.hex, yesterday.hex) >= MIN_HUE_SEPARATION_FROM_YESTERDAY;
  return farEnoughFromRecentDays && hueSeparatedFromYesterday;
}

// Runs the 200-candidate / relaxing-threshold picker against a fixed set
// of comparison days.
function pickGuardedCandidate(dateStr: string, recentDays: DailyTarget[], yesterday: DailyTarget): DailyTarget {
  const candidates = Array.from({ length: MAX_CANDIDATES }, (_, attempt) => baseCandidate(dateStr, attempt));

  for (let threshold = MIN_DELTA_E; threshold >= DELTA_E_RELAX_FLOOR; threshold -= DELTA_E_RELAX_STEP) {
    for (const candidate of candidates) {
      if (passesGuard(candidate, recentDays, yesterday, threshold)) {
        if (threshold < MIN_DELTA_E) {
          console.warn(`[dailyColorTableCore] relaxed deltaE threshold to ${threshold} for ${dateStr}`);
        }
        return candidate;
      }
    }
  }

  console.warn(
    `[dailyColorTableCore] falling back to an unguarded color for ${dateStr} — no candidate cleared threshold ${DELTA_E_RELAX_FLOOR} within ${MAX_CANDIDATES} tries`
  );
  return candidates[0];
}

// True if `candidateHex` clears MIN_HUE_SEPARATION_FROM_YESTERDAY (OKLCH)
// against each of the first `hueCheckDays` entries of `recentDays` —
// recentDays[0] is always yesterday, recentDays[1] the day before that,
// and so on, so "first N" means "the N most recent days".
function passesHueSeparation(candidateHex: string, recentDays: DailyTarget[], hueCheckDays: number): boolean {
  return recentDays.slice(0, hueCheckDays).every((day) => oklchHueSeparation(candidateHex, day.hex) >= MIN_HUE_SEPARATION_FROM_YESTERDAY);
}

function passesGuardV2(candidate: DailyTarget, recentDays: DailyTarget[], hueCheckDays: number, deltaEThreshold: number): boolean {
  const farEnoughFromRecentDays = recentDays.every((day) => deltaE2000(candidate.hex, day.hex) >= deltaEThreshold);
  return farEnoughFromRecentDays && passesHueSeparation(candidate.hex, recentDays, hueCheckDays);
}

// The variety fix's picker (dates >= HUE_GUARD_V2_EPOCH). Keeps the exact
// same deltaE 5-day guard and relaxation ladder as pickGuardedCandidate,
// but checks hue separation against the last MIN_HUE_SEPARATION_DAYS days
// instead of just yesterday. If nothing clears that at any deltaE
// threshold, the hue window itself relaxes: shrink from
// MIN_HUE_SEPARATION_DAYS down to yesterday-only (matching the old rule),
// retry the full deltaE ladder again, and only then fall back unguarded.
function pickGuardedCandidateV2(dateStr: string, recentDays: DailyTarget[]): DailyTarget {
  const candidates = Array.from({ length: MAX_CANDIDATES }, (_, attempt) => baseCandidate(dateStr, attempt));

  for (const hueCheckDays of [MIN_HUE_SEPARATION_DAYS, 1]) {
    for (let threshold = MIN_DELTA_E; threshold >= DELTA_E_RELAX_FLOOR; threshold -= DELTA_E_RELAX_STEP) {
      for (const candidate of candidates) {
        if (passesGuardV2(candidate, recentDays, hueCheckDays, threshold)) {
          if (threshold < MIN_DELTA_E || hueCheckDays < MIN_HUE_SEPARATION_DAYS) {
            console.warn(
              `[dailyColorTableCore] v2 guard relaxed (hue window=${hueCheckDays}d, deltaE threshold=${threshold}) for ${dateStr}`
            );
          }
          return candidate;
        }
      }
    }
  }

  console.warn(
    `[dailyColorTableCore] v2 guard falling back to an unguarded color for ${dateStr} — no candidate cleared any relaxation step within ${MAX_CANDIDATES} tries`
  );
  return candidates[0];
}

// One-off manual reroll, 2026-07-29 only. The originally-generated color
// for this date (#58E3D8, hue ~175) shipped before the variety fix above
// existed and read as "aqain" (another aqua) right after two blues/greens
// in a row. This forces a re-salt for this single date, with the variety
// fix's 3-day hue rule applied early (by hand) plus an explicit ban on
// the 150-200 degree aqua/teal band so it can't land back in the same
// spot. Not a general mechanism — HUE_GUARD_V2_EPOCH below is the real,
// ongoing fix, effective 2026-07-30 onward; this date is one day short of
// that epoch and needed a manual nudge instead.
const MANUAL_REROLL_DATE = '2026-07-29';
const MANUAL_REROLL_HUE_DAYS = 3;
const MANUAL_REROLL_AVOID_HUE_BAND: [number, number] = [150, 200];

function inAvoidBand(hue: number): boolean {
  return hue >= MANUAL_REROLL_AVOID_HUE_BAND[0] && hue <= MANUAL_REROLL_AVOID_HUE_BAND[1];
}

function pickManualReroll(dateStr: string, recentDays: DailyTarget[]): DailyTarget {
  const candidates = Array.from({ length: MAX_CANDIDATES }, (_, attempt) => baseCandidate(dateStr, attempt));

  for (let threshold = MIN_DELTA_E; threshold >= DELTA_E_RELAX_FLOOR; threshold -= DELTA_E_RELAX_STEP) {
    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const candidate = candidates[attempt];
      if (inAvoidBand(candidate.hue)) continue;
      const farEnoughFromRecentDays = recentDays.every((day) => deltaE2000(candidate.hex, day.hex) >= threshold);
      const hueOk = passesHueSeparation(candidate.hex, recentDays, MANUAL_REROLL_HUE_DAYS);
      if (farEnoughFromRecentDays && hueOk) {
        console.warn(
          `[dailyColorTableCore] manual reroll for ${dateStr}: salt=guard-${attempt}, deltaE threshold=${threshold}, ` +
            `hex=${candidate.hex}, hue=${candidate.hue.toFixed(2)}, saturation=${candidate.saturation.toFixed(2)}, lightness=${candidate.lightness.toFixed(2)}`
        );
        return candidate;
      }
    }
  }

  throw new Error(
    `[dailyColorTableCore] manual reroll for ${dateStr} found no candidate clearing deltaE >= ${DELTA_E_RELAX_FLOOR}, ` +
      `${MANUAL_REROLL_HUE_DAYS}-day hue separation, and the avoided hue band within ${MAX_CANDIDATES} tries`
  );
}

function daysBefore(date: Date, daysBack: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBack);
}

// Resolved results this run, keyed by "YYYY-MM-DD" — this is what makes
// "last 5 days" mean the days' *actual* guarded colors (each one possibly
// itself nudged), not their unadjusted formula output: resolving day N
// recurses into this same function for N-1..N-5, bottoming out at
// GUARD_EPOCH_DATE. Only ever run offline by generateDailyColorTable
// below, so the unbounded-recursion cost this implies (walking all the
// way back to the epoch) is a one-time build-time cost, not something a
// player's device ever pays.
const resolvedCache = new Map<string, DailyTarget>();

export function resolveDailyTargetByRecursion(date: Date): DailyTarget {
  const dateStr = dateToSeedString(date);
  const cached = resolvedCache.get(dateStr);
  if (cached) return cached;

  if (dateStr <= GUARD_EPOCH_DATE) {
    const result = baseCandidate(dateStr, 0);
    resolvedCache.set(dateStr, result);
    return result;
  }

  const recentDays = Array.from({ length: LOOKBACK_DAYS }, (_, i) => resolveDailyTargetByRecursion(daysBefore(date, i + 1)));

  let result: DailyTarget;
  if (dateStr === MANUAL_REROLL_DATE) {
    result = pickManualReroll(dateStr, recentDays);
  } else if (dateStr >= HUE_GUARD_V2_EPOCH) {
    result = pickGuardedCandidateV2(dateStr, recentDays);
  } else {
    result = pickGuardedCandidate(dateStr, recentDays, recentDays[0]);
  }

  resolvedCache.set(dateStr, result);
  return result;
}

// Builds the full table: one hex string per day from the first guarded
// date (GUARD_EPOCH_DATE + 1) through TABLE_DAYS days later. Pure — no
// file I/O — so both scripts/generateDailyColorTable.ts (which writes it
// to assets/dailyColorTable.json) and tests (which check the committed
// file still matches) can call it directly.
export function generateDailyColorTable(): string[] {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  const firstGuardedDate = new Date(year, month - 1, day + 1);

  return Array.from({ length: TABLE_DAYS }, (_, i) => {
    const date = new Date(firstGuardedDate.getFullYear(), firstGuardedDate.getMonth(), firstGuardedDate.getDate() + i);
    return resolveDailyTargetByRecursion(date).hex;
  });
}
