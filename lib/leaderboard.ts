// Builds the friends leaderboard/feed from `round_results`.

import { PHOTOS_PER_ROUND } from '../context/RoundContext';
import { badgeForPoints, cycleInfo, cyclePoints, type Badge } from './cycle';
import { crownedUserIds } from './leaderboardRanking';
import { computeStreak, todayKey } from './streak';
import { supabase } from './supabase';
import { fetchThumbnailUrls, thumbnailPath } from './thumbnails';

// The ranking rules live in lib/leaderboardRanking.ts (so they can be
// unit-tested without Supabase) — re-exported here so screens keep
// importing rankLeaderboard from this file.
export { rankLeaderboard } from './leaderboardRanking';

// Supabase hands back a limited number of rows per request (about 1,000
// by default) and silently drops the rest, so round_results is read in
// pages. This is how many rows each page *asks* for — the server may
// send fewer (see fetchAllRounds below).
const ROUNDS_PAGE_SIZE = 1000;
// A safety stop for the paging loop: 200 pages. Even if the server only
// sent 100 rows per page, that's 20,000 rows, far more than any friends
// list will have. Reaching it means something is wrong (for example the
// server ignoring the page range), so it fails loudly instead of looping
// on forever.
const MAX_ROUNDS_PAGES = 200;

type RoundRow = { user_id: string; date_key: string; outcome: string; average: number; scores: number[]; hex: string };

// Every round_results row for these players, read page by page. Ordered by
// (user_id, date_key) — one row per player per day, so that order is
// unique and pages never overlap or skip under normal conditions.
//
// Each page asks for ROUNDS_PAGE_SIZE rows, but the server may be set to
// send fewer per request. So the next page starts right after the rows
// that actually arrived, and a short page is NOT treated as the end —
// it might just be the server's own limit. Only an empty page proves
// there's nothing left. That costs one extra (empty) request at the end,
// but never silently drops rows. Any failed page throws, the same way the
// single query used to.
async function fetchAllRounds(userIds: string[]): Promise<RoundRow[]> {
  const rows: RoundRow[] = [];
  let from = 0;
  for (let page = 0; page < MAX_ROUNDS_PAGES; page++) {
    const { data, error } = await supabase
      .from('round_results')
      .select('user_id, date_key, outcome, average, scores, hex')
      .in('user_id', userIds)
      .order('user_id', { ascending: true })
      .order('date_key', { ascending: true })
      .range(from, from + ROUNDS_PAGE_SIZE - 1);
    if (error) throw error;

    const pageRows = (data ?? []) as RoundRow[];
    if (pageRows.length === 0) return rows;
    rows.push(...pageRows);
    from += pageRows.length;
  }
  throw new Error(`fetchAllRounds: stopped after ${MAX_ROUNDS_PAGES} pages without reaching the end`);
}

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
  // Points earned so far in the current 30-day cycle (lib/cycle.ts),
  // today's round included once it's been played.
  cyclePoints: number;
  // The badge those points already reach, or null below Bronze.
  badgeSoFar: Badge | null;
  // True for the top scorer(s) of the previous cycle — see
  // crownedUserIds in lib/leaderboardRanking.ts.
  hasCrown: boolean;
};

// One entry per id in `[userId, ...friendIds]`. Relies on round_results'
// RLS (own rows + accepted friends' rows) to make the `.in(...)` query
// safe even if the id list were ever wrong — a stranger's rows just
// wouldn't come back. Same reasoning applies to the thumbnails bucket's
// own RLS for the signed-URL fetch below.
export async function fetchLeaderboard(userId: string, friendIds: string[]): Promise<LeaderboardEntry[]> {
  const allIds = [userId, ...friendIds];

  const [{ data: profiles, error: profilesError }, rounds] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', allIds),
    fetchAllRounds(allIds),
  ]);
  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const roundsByUserId = new Map<string, RoundRow[]>();
  // Seen (user_id, date_key) pairs. The table allows only one row per
  // player per day, but a row written while the pages were being read
  // could shift a page boundary and show up twice — and a repeated date
  // would break computeStreak's day-after-day check. So each pair is kept
  // once.
  const seenUserDays = new Set<string>();
  for (const row of rounds) {
    const userDay = `${row.user_id}|${row.date_key}`;
    if (seenUserDays.has(userDay)) continue;
    seenUserDays.add(userDay);
    const list = roundsByUserId.get(row.user_id) ?? [];
    list.push(row);
    roundsByUserId.set(row.user_id, list);
  }

  const today = todayKey();
  const currentCycle = cycleInfo(today).cycleNumber;
  const crowned = crownedUserIds(allIds, roundsByUserId, today);
  const entriesWithoutThumbnails = allIds.map((id) => {
    const rows = (roundsByUserId.get(id) ?? []).slice().sort((a, b) => a.date_key.localeCompare(b.date_key));
    // Streak is activity-based: any played day counts, pass or fail —
    // see lib/streak.ts, the same rule StreakContext applies locally.
    const playedDateKeys = rows.map((row) => row.date_key);
    const todayRow = rows.find((row) => row.date_key === today);
    const points = cyclePoints(rows, currentCycle);

    return {
      userId: id,
      displayName: nameById.get(id) ?? 'Player',
      streak: computeStreak(playedDateKeys, today),
      playedToday: !!todayRow,
      todayAverage: todayRow?.average ?? null,
      passedToday: todayRow?.outcome === 'passed',
      scores: todayRow?.scores ?? [],
      hex: todayRow?.hex ?? null,
      cyclePoints: points,
      badgeSoFar: badgeForPoints(points),
      hasCrown: crowned.has(id),
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
