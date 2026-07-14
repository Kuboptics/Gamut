// Shared by context/StreakContext.tsx (local, fed every locally-played
// date key) and lib/leaderboard.ts (cloud, fed every date key a friend
// has round_results for), so "streak" means the exact same thing no
// matter which account or device is asking.

// True if `nextDateKey` is exactly one calendar day after `dateKey`.
function isNextDay(dateKey: string, nextDateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return expected === nextDateKey;
}

// Counts the consecutive-day run at the end of a sorted (ascending) list
// of "played" date keys — any day played counts, pass or fail; only a day
// with no entry at all breaks the chain. A gap anywhere before the end
// doesn't matter, since only the trailing run is the current streak.
export function computeStreak(playedDateKeysAscending: string[]): number {
  let streak = 0;
  let lastPlayedDateKey: string | null = null;
  for (const dateKey of playedDateKeysAscending) {
    const isConsecutive = lastPlayedDateKey !== null && isNextDay(lastPlayedDateKey, dateKey);
    streak = isConsecutive ? streak + 1 : 1;
    lastPlayedDateKey = dateKey;
  }
  return streak;
}
