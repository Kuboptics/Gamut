import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleRangeFor } from './cycle';
import { crownedUserIds, rankLeaderboard, type PointsRow, type RankableEntry } from './leaderboardRanking';

// A leaderboard row with sensible defaults, so each test only spells out
// the fields it's actually about.
function entry(overrides: Partial<RankableEntry> & { userId: string }): RankableEntry {
  return {
    displayName: overrides.userId,
    streak: 0,
    playedToday: false,
    todayAverage: null,
    cyclePoints: 0,
    ...overrides,
  };
}

function order(entries: RankableEntry[]): string[] {
  return rankLeaderboard(entries).map((e) => e.userId);
}

// One row per day, starting on `startKey`, with the given averages.
function rowsFrom(startKey: string, averages: number[]): PointsRow[] {
  const [year, month, day] = startKey.split('-').map(Number);
  return averages.map((average, i) => ({
    date_key: new Date(Date.UTC(year, month - 1, day + i)).toISOString().slice(0, 10),
    average,
  }));
}

// --- Ranking ---

test('cycle points decide first, ahead of streak and today', () => {
  const ranked = order([
    entry({ userId: 'a', cyclePoints: 300, streak: 1 }),
    entry({ userId: 'b', cyclePoints: 900, streak: 0 }),
    entry({ userId: 'c', cyclePoints: 500, streak: 40, playedToday: true, todayAverage: 100 }),
  ]);
  assert.deepEqual(ranked, ['b', 'c', 'a']);
});

test('equal points fall back to streak', () => {
  const ranked = order([
    entry({ userId: 'a', cyclePoints: 500, streak: 2 }),
    entry({ userId: 'b', cyclePoints: 500, streak: 9 }),
  ]);
  assert.deepEqual(ranked, ['b', 'a']);
});

test('equal points and streak fall back to today, with not played lowest (below 0%)', () => {
  const ranked = order([
    entry({ userId: 'notPlayed', cyclePoints: 500, streak: 3 }),
    entry({ userId: 'zero', cyclePoints: 500, streak: 3, playedToday: true, todayAverage: 0 }),
    entry({ userId: 'high', cyclePoints: 500, streak: 3, playedToday: true, todayAverage: 80 }),
  ]);
  assert.deepEqual(ranked, ['high', 'zero', 'notPlayed']);
});

test('everything else equal falls back to name A to Z, then user id', () => {
  const ranked = order([
    entry({ userId: 'id-3', displayName: 'Mia' }),
    entry({ userId: 'id-2', displayName: 'Alex' }),
    entry({ userId: 'id-9', displayName: 'Sam' }),
    entry({ userId: 'id-1', displayName: 'Sam' }), // same name: user id decides
  ]);
  assert.deepEqual(ranked, ['id-2', 'id-3', 'id-1', 'id-9']);
});

test('the order is the same whatever order the entries arrive in', () => {
  const entries = [
    entry({ userId: 'a', cyclePoints: 200, streak: 1 }),
    entry({ userId: 'b', cyclePoints: 200, streak: 1, displayName: 'a' }),
    entry({ userId: 'c', cyclePoints: 650 }),
    entry({ userId: 'd', cyclePoints: 200, streak: 1, playedToday: true, todayAverage: 40 }),
  ];
  const expected = order(entries);
  assert.deepEqual(order(entries.slice().reverse()), expected);
  assert.deepEqual(order([entries[2], entries[0], entries[3], entries[1]]), expected);
});

test('ranking returns a sorted copy and leaves the input alone', () => {
  const entries = [entry({ userId: 'a', cyclePoints: 1 }), entry({ userId: 'b', cyclePoints: 2 })];
  rankLeaderboard(entries);
  assert.deepEqual(
    entries.map((e) => e.userId),
    ['a', 'b']
  );
});

// --- Crown ---

// Today is in cycle 2, so the crown goes to cycle 1's top scorer.
const CYCLE_2_DAY = cycleRangeFor(2).startKey;
const CYCLE_1_START = cycleRangeFor(1).startKey;

test('crown: a clear winner of the previous cycle', () => {
  const rows = new Map<string, PointsRow[]>([
    ['a', rowsFrom(CYCLE_1_START, [90, 90, 90])], // 420
    ['b', rowsFrom(CYCLE_1_START, [100, 100])], // 300
  ]);
  assert.deepEqual([...crownedUserIds(['a', 'b'], rows, CYCLE_2_DAY)], ['a']);
});

test('crown: a tie shares the crown', () => {
  const rows = new Map<string, PointsRow[]>([
    ['a', rowsFrom(CYCLE_1_START, [50, 50])], // 200
    ['b', rowsFrom(CYCLE_1_START, [100, 0])], // 200
    ['c', rowsFrom(CYCLE_1_START, [10])], // 60
  ]);
  assert.deepEqual([...crownedUserIds(['a', 'b', 'c'], rows, CYCLE_2_DAY)].sort(), ['a', 'b']);
});

test('crown: nobody gets it when the best previous total is 0', () => {
  // Rows exist, but only in the current cycle — the previous one is empty.
  const rows = new Map<string, PointsRow[]>([['a', rowsFrom(CYCLE_2_DAY, [100])]]);
  assert.equal(crownedUserIds(['a', 'b'], rows, CYCLE_2_DAY).size, 0);
});

test('crown: nobody gets it during cycle 1, since no cycle has finished', () => {
  const rows = new Map<string, PointsRow[]>([['a', rowsFrom(CYCLE_1_START, [100, 100, 100])]]);
  assert.equal(crownedUserIds(['a'], rows, CYCLE_1_START).size, 0);
  assert.equal(crownedUserIds(['a'], rows, cycleRangeFor(1).endKey).size, 0);
});

test('crown: a player with no rows counts as 0 and never breaks the result', () => {
  const rows = new Map<string, PointsRow[]>([['a', rowsFrom(CYCLE_1_START, [40])]]);
  const crowned = crownedUserIds(['a', 'noRows'], rows, CYCLE_2_DAY);
  assert.deepEqual([...crowned], ['a']);
  // And on their own, a board of only row-less players has no crown.
  assert.equal(crownedUserIds(['noRows'], new Map(), CYCLE_2_DAY).size, 0);
});
