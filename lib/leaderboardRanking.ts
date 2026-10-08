// The leaderboard's ranking and crown rules, kept as plain functions with
// no Supabase or React imports — so they can be unit-tested with node
// (see lib/leaderboard.test.ts). lib/leaderboard.ts does the fetching and
// calls into this file; it also re-exports rankLeaderboard so screens
// keep importing it from lib/leaderboard as before.

import { cycleInfo, cyclePoints } from './cycle';

// The minimum a leaderboard row needs for ranking. LeaderboardEntry
// (lib/leaderboard.ts) has these plus more; rankLeaderboard hands back
// whatever full type it was given.
export type RankableEntry = {
  userId: string;
  displayName: string;
  streak: number;
  playedToday: boolean;
  // Null when playedToday is false.
  todayAverage: number | null;
  cyclePoints: number;
};

// The round_results columns the cycle math needs.
export type PointsRow = { date_key: string; average: number };

// Not-played sorts below any real score (including 0%), so someone who's
// played today outranks someone who hasn't, all else equal.
function todayScoreForSort(entry: RankableEntry): number {
  return entry.playedToday && entry.todayAverage !== null ? entry.todayAverage : -1;
}

// Negative when `a` should come first. Keys in order: cycle points
// (highest first), streak (highest first), today's score (highest first),
// name A to Z, then user id. User ids are unique, so no two different
// players ever compare as equal — the order is fully deterministic, never
// left to chance.
function compareEntries(a: RankableEntry, b: RankableEntry): number {
  if (b.cyclePoints !== a.cyclePoints) return b.cyclePoints - a.cyclePoints;
  if (b.streak !== a.streak) return b.streak - a.streak;
  const scoreDiff = todayScoreForSort(b) - todayScoreForSort(a);
  if (scoreDiff !== 0) return scoreDiff;
  const nameDiff = a.displayName.localeCompare(b.displayName);
  if (nameDiff !== 0) return nameDiff;
  // Plain comparison rather than localeCompare: the final tiebreak
  // should never depend on the phone's language settings.
  if (a.userId < b.userId) return -1;
  if (a.userId > b.userId) return 1;
  return 0;
}

// Returns a sorted copy; the input array is left as it was.
export function rankLeaderboard<T extends RankableEntry>(entries: T[]): T[] {
  return entries.slice().sort(compareEntries);
}

// Which players wear the crown: whoever scored the most cycle points in
// the cycle *before* today's. Ties share the crown. Nobody gets one when
// there's no finished cycle yet (today is in cycle 1 or earlier) or when
// the best total was 0. Computed fresh from round_results rows every
// time — nothing about the crown is stored.
//
// `userIds` lists every player on the board, so someone with no rows at
// all still counts (with 0 points) rather than being skipped.
export function crownedUserIds(
  userIds: string[],
  rowsByUserId: Map<string, PointsRow[]>,
  today: string
): Set<string> {
  const previousCycle = cycleInfo(today).cycleNumber - 1;
  if (previousCycle < 1) return new Set();

  const pointsByUserId = new Map(
    userIds.map((id) => [id, cyclePoints(rowsByUserId.get(id) ?? [], previousCycle)])
  );
  const best = Math.max(0, ...pointsByUserId.values());
  if (best === 0) return new Set();

  return new Set(userIds.filter((id) => pointsByUserId.get(id) === best));
}
