// Builds the friends leaderboard/feed from `round_results`.

import { PHOTOS_PER_ROUND } from '../context/RoundContext';
import { computeStreak, todayKey } from './streak';
import { supabase } from './supabase';
import { fetchThumbnailUrls, thumbnailPath } from './thumbnails';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  streak: number;
  playedToday: boolean;
  // Null when `playedToday` is false — there's no score to show yet.
  todayAverage: number | null;
  passedToday: boolean;
  // Empty when `playedToday` is false, or when a thumbnail failed to
  // resolve (e.g. this account hasn't uploaded one for a slot yet) —
  // never a reason to fail the whole row.
  thumbnailUrls: string[];
  // Per-shot scores, same slot order as thumbnailUrls (both come from
  // the same 0/1/2 round slots — see context/RoundContext.tsx). Empty
  // when `playedToday` is false.
  scores: number[];
  // Today's target color — the same for every player, but carried per
  // entry since that's what the row/photo-viewer already has in hand.
  // Null when `playedToday` is false.
  hex: string | null;
};

// One entry per id in `[userId, ...friendIds]`. Relies on round_results'
// RLS (own rows + accepted friends' rows) to make the `.in(...)` query
// safe even if the id list were ever wrong — a stranger's rows just
// wouldn't come back. Same reasoning applies to the thumbnails bucket's
// own RLS for the signed-URL fetch below.
export async function fetchLeaderboard(userId: string, friendIds: string[]): Promise<LeaderboardEntry[]> {
  const allIds = [userId, ...friendIds];

  const [{ data: profiles, error: profilesError }, { data: rounds, error: roundsError }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', allIds),
    supabase.from('round_results').select('user_id, date_key, outcome, average, scores, hex').in('user_id', allIds),
  ]);
  if (profilesError) throw profilesError;
  if (roundsError) throw roundsError;

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const roundsByUserId = new Map<
    string,
    { date_key: string; outcome: string; average: number; scores: number[]; hex: string }[]
  >();
  for (const row of rounds ?? []) {
    const list = roundsByUserId.get(row.user_id) ?? [];
    list.push(row);
    roundsByUserId.set(row.user_id, list);
  }

  const today = todayKey();
  const entriesWithoutThumbnails = allIds.map((id) => {
    const rows = (roundsByUserId.get(id) ?? []).slice().sort((a, b) => a.date_key.localeCompare(b.date_key));
    // Streak is activity-based: any played day counts, pass or fail —
    // see lib/streak.ts, the same rule StreakContext applies locally.
    const playedDateKeys = rows.map((row) => row.date_key);
    const todayRow = rows.find((row) => row.date_key === today);

    return {
      userId: id,
      displayName: nameById.get(id) ?? 'Player',
      streak: computeStreak(playedDateKeys, today),
      playedToday: !!todayRow,
      todayAverage: todayRow?.average ?? null,
      passedToday: todayRow?.outcome === 'passed',
      scores: todayRow?.scores ?? [],
      hex: todayRow?.hex ?? null,
    };
  });

  // Only fetch thumbnails for people who actually played today — nobody
  // else has anything current to show (see lib/thumbnails.ts for why a
  // stale file from an earlier day is never a concern here).
  const playedTodayIds = entriesWithoutThumbnails.filter((entry) => entry.playedToday).map((entry) => entry.userId);
  const paths = playedTodayIds.flatMap((id) =>
    Array.from({ length: PHOTOS_PER_ROUND }, (_, slot) => thumbnailPath(id, slot))
  );
  const urlByPath = await fetchThumbnailUrls(paths);

  return entriesWithoutThumbnails.map((entry) => {
    if (!entry.playedToday) return { ...entry, thumbnailUrls: [] };
    // Keeps a slot's position even when its thumbnail failed to resolve
    // (an empty string, not skipped) — thumbnailUrls[slot] must always
    // line up with scores[slot], the same slot ordering RoundContext
    // uses, or the photo viewer would pair a shot with the wrong score.
    // FriendThumbnails only renders the non-empty ones.
    const thumbnailUrls = Array.from(
      { length: PHOTOS_PER_ROUND },
      (_, slot) => urlByPath.get(thumbnailPath(entry.userId, slot)) ?? ''
    );
    return { ...entry, thumbnailUrls };
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
