// The repeating 30-day points cycle for the friends leaderboard. Every
// played day earns BASE_POINTS_PER_DAY plus that day's average score
// (0-100), so 50-150 points a day; a missed day earns nothing. Points add
// up over one cycle, and the total decides the end-of-cycle badge.
//
// Plain functions only — no React, no Supabase — so the same math can run
// anywhere (leaderboard, profile, tests) and always agrees with itself.
//
// Date keys are the app's usual "YYYY-MM-DD" strings. All day counting
// here is done in UTC (see utcDayNumber below), the same pattern as
// lib/dailyColor.ts, so a daylight-saving change can never shift a day
// into the wrong cycle.

// PERMANENT. These define which days belong to which cycle. Changing any
// of them after release would silently rewrite every past cycle's result.
export const CYCLE_ANCHOR = '2026-10-08'; // first day of cycle number 1
export const CYCLE_DAYS = 30;
export const BASE_POINTS_PER_DAY = 50;

export type Badge = 'diamond' | 'gold' | 'silver' | 'bronze';

// Minimum cycle points for each badge. Ordered highest first —
// badgeForPoints below returns the first one a total reaches.
export const BADGE_THRESHOLDS: readonly { badge: Badge; minPoints: number }[] = [
  { badge: 'diamond', minPoints: 3750 },
  { badge: 'gold', minPoints: 2800 },
  { badge: 'silver', minPoints: 1900 },
  { badge: 'bronze', minPoints: 950 },
];

const MS_PER_DAY = 86_400_000;

// Turns "YYYY-MM-DD" into a whole day count (days since 1970-01-01).
// Date.UTC has no time zone and no daylight saving, so each calendar day
// is exactly MS_PER_DAY apart and the division always lands on a whole
// number.
function utcDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

// The reverse of utcDayNumber: a day count back into "YYYY-MM-DD". Reads
// the UTC parts on purpose — the device's local time zone could otherwise
// move the date by one.
function dateKeyFromUtcDayNumber(dayNumber: number): string {
  const date = new Date(dayNumber * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ANCHOR_DAY_NUMBER = utcDayNumber(CYCLE_ANCHOR);

// The first and last date key of a given cycle. Cycle 1 starts on
// CYCLE_ANCHOR; cycle 0 is the 30 days just before it, and so on.
export function cycleRangeFor(cycleNumber: number): { startKey: string; endKey: string } {
  const startDayNumber = ANCHOR_DAY_NUMBER + (cycleNumber - 1) * CYCLE_DAYS;
  return {
    startKey: dateKeyFromUtcDayNumber(startDayNumber),
    endKey: dateKeyFromUtcDayNumber(startDayNumber + CYCLE_DAYS - 1),
  };
}

// Which cycle a day falls in, and where in that cycle it sits.
// dayInCycle runs 1-30; daysLeft is how many days come after this one.
export function cycleInfo(dateKey: string): {
  cycleNumber: number;
  dayInCycle: number;
  daysLeft: number;
  startKey: string;
  endKey: string;
} {
  // Days since the anchor: 0 on the anchor itself, negative before it.
  const daysSinceAnchor = utcDayNumber(dateKey) - ANCHOR_DAY_NUMBER;
  // Math.floor (not a plain division or %) so dates before the anchor
  // round down into cycle 0, -1, ... instead of wrongly landing in cycle 1.
  const cycleNumber = Math.floor(daysSinceAnchor / CYCLE_DAYS) + 1;
  const dayInCycle = daysSinceAnchor - (cycleNumber - 1) * CYCLE_DAYS + 1;
  return {
    cycleNumber,
    dayInCycle,
    daysLeft: CYCLE_DAYS - dayInCycle,
    ...cycleRangeFor(cycleNumber),
  };
}

// Points for one played day: the base plus the day's average, rounded
// and kept within 0-100 so a bad value can never inflate or sink a total.
// A non-number average counts as 0 rather than turning the sum into NaN.
export function pointsForDay(average: number): number {
  const safeAverage = Number.isFinite(average) ? Math.min(100, Math.max(0, Math.round(average))) : 0;
  return BASE_POINTS_PER_DAY + safeAverage;
}

// Total points for one cycle. Rows outside the cycle are ignored, and
// each date_key counts at most once (the first row seen for it), so a
// duplicated row can never double a day. A missed day simply has no row.
export function cyclePoints(rows: { date_key: string; average: number }[], cycleNumber: number): number {
  const { startKey, endKey } = cycleRangeFor(cycleNumber);
  const countedDateKeys = new Set<string>();
  let total = 0;
  for (const row of rows) {
    // "YYYY-MM-DD" strings sort the same as the dates they name, so a
    // plain string comparison checks the range.
    if (row.date_key < startKey || row.date_key > endKey) continue;
    if (countedDateKeys.has(row.date_key)) continue;
    countedDateKeys.add(row.date_key);
    total += pointsForDay(row.average);
  }
  return total;
}

// The badge a cycle total earns, or null below the Bronze threshold.
export function badgeForPoints(points: number): Badge | null {
  return BADGE_THRESHOLDS.find((threshold) => points >= threshold.minPoints)?.badge ?? null;
}
