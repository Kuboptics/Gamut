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

// "YYYY-MM-DD" for right now, in local time — the reference point
// computeStreak checks the most recent played day against, and what both
// StreakContext and the leaderboard use for "did they play today".
export function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Counts the consecutive-day run at the end of a sorted (ascending) list
// of "played" date keys — any day played counts, pass or fail; only a day
// with no entry at all breaks the chain. A gap anywhere before the end
// doesn't matter, since only the trailing run is the current streak —
// *provided* that trailing run is still current: if the most recent played
// day is older than yesterday, a full day was skipped since then, so the
// streak is broken (0) no matter how long the run before it was. Without
// this check a streak earned days ago would silently freeze forever
// instead of resetting once a day gets missed.
export function computeStreak(playedDateKeysAscending: string[], today: string = todayKey()): number {
  if (playedDateKeysAscending.length === 0) return 0;

  const lastPlayed = playedDateKeysAscending[playedDateKeysAscending.length - 1];
  const isStillCurrent = lastPlayed === today || isNextDay(lastPlayed, today);
  if (!isStillCurrent) return 0;

  let streak = 0;
  let lastPlayedDateKey: string | null = null;
  for (const dateKey of playedDateKeysAscending) {
    const isConsecutive = lastPlayedDateKey !== null && isNextDay(lastPlayedDateKey, dateKey);
    streak = isConsecutive ? streak + 1 : 1;
    lastPlayedDateKey = dateKey;
  }
  return streak;
}
