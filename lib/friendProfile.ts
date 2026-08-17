// Talks to `profiles` and `round_results` in Supabase to build one
// friend's full round history for the friend profile screen
// (app/friend/[id].tsx). Pure network function — no React here, same
// pattern as lib/leaderboard.ts and lib/historySync.ts.
//
// This is a new query, not a reuse of fetchLeaderboard: fetchLeaderboard
// already selects every round_results row per friend, but only to derive
// a streak number — it keeps just today's row and throws the rest away
// before returning (see lib/leaderboard.ts). A friend's full day-by-day
// history needs its own function that keeps every row instead.
//
// No RLS change needed: round_results' existing SELECT policy already
// lets a signed-in user read their accepted friends' rows (own rows +
// accepted friends' rows) — fetchLeaderboard already depends on that
// same policy, unfiltered by date, for the same table.

import { computeStreak, todayKey } from './streak';
import { supabase } from './supabase';

// One played day, newest-first once sorted by the caller's query. Field
// names match FriendDay's own vocabulary (camelCase), not the raw
// snake_case Supabase columns — see fetchFriendHistory below for the
// mapping.
export type FriendDay = {
  dateKey: string;
  hex: string;
  hue: number;
  saturation: number;
  lightness: number;
  colorName: string;
  scores: number[];
  average: number;
  outcome: 'passed' | 'failed';
};

export type FriendHistory = {
  displayName: string;
  days: FriendDay[];
  // Same streak every other screen shows for this player (see
  // lib/streak.ts's computeStreak, also used by lib/leaderboard.ts) — not
  // a second, independent streak calculation.
  streak: number;
  // Mean of every day's average, rounded. Null when there are no days at
  // all — nothing to average.
  average: number | null;
  // The single best day (highest average) — enough fields to render the
  // summary card's hero swatch (hex), its color name, its score, and its
  // date. Null when there are no days.
  best: { average: number; dateKey: string; hex: string; colorName: string } | null;
};

// Raw shape of a round_results row, as selected below.
type RoundRow = {
  date_key: string;
  hex: string;
  hue: number;
  saturation: number;
  lightness: number;
  color_name: string;
  scores: number[];
  average: number;
  outcome: 'passed' | 'failed';
};

export async function fetchFriendHistory(friendId: string): Promise<FriendHistory> {
  const [{ data: profile, error: profileError }, { data: rows, error: roundsError }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', friendId).maybeSingle(),
    supabase
      .from('round_results')
      .select('date_key, hex, hue, saturation, lightness, color_name, scores, average, outcome')
      .eq('user_id', friendId)
      .order('date_key', { ascending: false }),
  ]);
  if (profileError) throw profileError;
  if (roundsError) throw roundsError;

  const days: FriendDay[] = ((rows ?? []) as RoundRow[]).map((row) => ({
    dateKey: row.date_key,
    hex: row.hex,
    hue: row.hue,
    saturation: row.saturation,
    lightness: row.lightness,
    colorName: row.color_name,
    scores: row.scores,
    average: row.average,
    outcome: row.outcome,
  }));

  // computeStreak needs its dates ascending (oldest first) — `days` above
  // is descending (newest first, for display), so this re-sorts rather
  // than assuming the query's own order. Same call shape lib/leaderboard.ts
  // uses: an ascending date_key list plus "today".
  const playedDateKeysAscending = days.map((day) => day.dateKey).sort((a, b) => a.localeCompare(b));
  const streak = computeStreak(playedDateKeysAscending, todayKey());

  const average =
    days.length === 0 ? null : Math.round(days.reduce((sum, day) => sum + day.average, 0) / days.length);

  const best =
    days.length === 0
      ? null
      : days.reduce((best, day) => (day.average > best.average ? day : best), days[0]);

  return {
    displayName: profile?.display_name ?? 'Player',
    days,
    streak,
    average,
    best: best ? { average: best.average, dateKey: best.dateKey, hex: best.hex, colorName: best.colorName } : null,
  };
}
