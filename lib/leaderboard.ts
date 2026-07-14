// Builds the friends leaderboard/feed from `round_results` — see the
// Stage 5 plan for why streak is recomputed here rather than read from
// StreakContext (which is local-only and never synced, so it has no way
// to answer "what's my friend's streak").

import { supabase } from './supabase';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  streak: number;
  playedToday: boolean;
  passedToday: boolean;
};

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// True if `nextDateKey` is exactly one calendar day after `dateKey`.
function isNextDay(dateKey: string, nextDateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return expected === nextDateKey;
}

// Replays the same rule StreakContext.recordPass applies locally —
// streak only extends when the previous pass was exactly the day before —
// over a user's full passed-day history, so a friend's streak is derived
// from the same synced source of truth as everyone else's, rather than
// trusting each device's own local counter.
export function computeStreak(passedDateKeysAscending: string[]): number {
  let streak = 0;
  let lastPassedDateKey: string | null = null;
  for (const dateKey of passedDateKeysAscending) {
    const isConsecutive = lastPassedDateKey !== null && isNextDay(lastPassedDateKey, dateKey);
    streak = isConsecutive ? streak + 1 : 1;
    lastPassedDateKey = dateKey;
  }
  return streak;
}

// One entry per id in `[userId, ...friendIds]`. Relies on round_results'
// RLS (own rows + accepted friends' rows) to make the `.in(...)` query
// safe even if the id list were ever wrong — a stranger's rows just
// wouldn't come back.
export async function fetchLeaderboard(userId: string, friendIds: string[]): Promise<LeaderboardEntry[]> {
  const allIds = [userId, ...friendIds];

  const [{ data: profiles, error: profilesError }, { data: rounds, error: roundsError }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', allIds),
    supabase.from('round_results').select('user_id, date_key, outcome').in('user_id', allIds),
  ]);
  if (profilesError) throw profilesError;
  if (roundsError) throw roundsError;

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const roundsByUserId = new Map<string, { date_key: string; outcome: string }[]>();
  for (const row of rounds ?? []) {
    const list = roundsByUserId.get(row.user_id) ?? [];
    list.push(row);
    roundsByUserId.set(row.user_id, list);
  }

  const today = todayKey();
  return allIds.map((id) => {
    const rows = (roundsByUserId.get(id) ?? []).slice().sort((a, b) => a.date_key.localeCompare(b.date_key));
    const passedDateKeys = rows.filter((row) => row.outcome === 'passed').map((row) => row.date_key);
    const todayRow = rows.find((row) => row.date_key === today);

    return {
      userId: id,
      displayName: nameById.get(id) ?? 'Player',
      streak: computeStreak(passedDateKeys),
      playedToday: !!todayRow,
      passedToday: todayRow?.outcome === 'passed',
    };
  });
}
