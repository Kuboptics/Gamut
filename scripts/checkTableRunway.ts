// Fails the build (non-zero exit) if assets/dailyColorTable.json covers
// less than MIN_RUNWAY_MONTHS from today. Wired into "eas-build-pre-install"
// in package.json, which EAS Build runs automatically on every build —
// so this is the thing that actually stops a TestFlight/App Store build
// from shipping with an expiring table, not just a note to remember.
//
// Why this can't be the runtime console.error in lib/dailyColor.ts alone:
// that only fires once a real device's clock actually walks off the end
// of the table, and console output from a TestFlight/App Store build is
// never seen by anyone — the table would silently fall back to unguarded
// colors for every player, with no signal anywhere, until someone thought
// to check. Catching it here means a stale table fails the *build*,
// months before any real device could ever reach the end of it.

import dailyColorTable from '../assets/dailyColorTable.json';
import { GUARD_EPOCH_DATE } from '../lib/dailyColor';

const MIN_RUNWAY_MONTHS = 12;

function firstGuardedDate(): Date {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  return new Date(year, month - 1, day + 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

const today = new Date();
const lastCoveredDate = addDays(firstGuardedDate(), dailyColorTable.length - 1);
const requiredThroughDate = addMonths(today, MIN_RUNWAY_MONTHS);

const dateLabel = (date: Date) => date.toISOString().slice(0, 10);

if (lastCoveredDate.getTime() < requiredThroughDate.getTime()) {
  console.error(
    `[checkTableRunway] assets/dailyColorTable.json only covers through ${dateLabel(lastCoveredDate)}, which is less than the required ${MIN_RUNWAY_MONTHS} months of runway from today (${dateLabel(today)}) — needs to cover at least through ${dateLabel(requiredThroughDate)}.\n` +
      `Run "npm run generate:daily-colors" to extend it, review the diff (see the "table is append-only" test), commit, and rebuild.`
  );
  process.exit(1);
}

const runwayDays = Math.round((lastCoveredDate.getTime() - today.getTime()) / 86_400_000);
console.log(
  `[checkTableRunway] OK — table covers through ${dateLabel(lastCoveredDate)}, ${runwayDays} days (>= ${MIN_RUNWAY_MONTHS} months) of runway from today (${dateLabel(today)}).`
);
