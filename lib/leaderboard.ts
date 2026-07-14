// Builds the friends leaderboard/feed from `round_results`.

import { computeStreak } from './streak';
import { supabase } from './supabase';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  streak: number;
  playedToday: boolean;
  // Null when `playedToday` is false — there's no score to show yet.
  todayAverage: number | null;
  passedToday: boolean;
};

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// One entry per id in `[userId, ...friendIds]`. Relies on round_results'
// RLS (own rows + accepted friends' rows) to make the `.in(...)` query
// safe even if the id list were ever wrong — a stranger's rows just
// wouldn't come back.
export async function fetchLeaderboard(userId: string, friendIds: string[]): Promise<LeaderboardEntry[]> {
  const allIds = [userId, ...friendIds];

  const [{ data: profiles, error: profilesError }, { data: rounds, error: roundsError }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', allIds),
    supabase.from('round_results').select('user_id, date_key, outcome, average').in('user_id', allIds),
  ]);
  if (profilesError) throw profilesError;
  if (roundsError) throw roundsError;

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const roundsByUserId = new Map<string, { date_key: string; outcome: string; average: number }[]>();
  for (const row of rounds ?? []) {
    const list = roundsByUserId.get(row.user_id) ?? [];
    list.push(row);
    roundsByUserId.set(row.user_id, list);
  }

  const today = todayKey();
  return allIds.map((id) => {
    const rows = (roundsByUserId.get(id) ?? []).slice().sort((a, b) => a.date_key.localeCompare(b.date_key));
    // Streak is activity-based: any played day counts, pass or fail —
    // see lib/streak.ts, the same rule StreakContext applies locally.
    const playedDateKeys = rows.map((row) => row.date_key);
    const todayRow = rows.find((row) => row.date_key === today);

    return {
      userId: id,
      displayName: nameById.get(id) ?? 'Player',
      streak: computeStreak(playedDateKeys),
      playedToday: !!todayRow,
      todayAverage: todayRow?.average ?? null,
      passedToday: todayRow?.outcome === 'passed',
    };
  });
}

// Not-played sorts below any real score (including 0%), so someone who's
// played today outranks someone who hasn't, all else equal.
function todayScoreForSort(entry: LeaderboardEntry): number {
  return entry.playedToday ? entry.todayAverage! : -1;
}

// Streak descending, then today's score descending, then alphabetical by
// name — the last of which is what actually decides ties between two
// people who haven't played today, since they both sort at the same
// not-played sentinel.
export function rankLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.slice().sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    const scoreDiff = todayScoreForSort(b) - todayScoreForSort(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.displayName.localeCompare(b.displayName);
  });
}
