import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeForPoints, cycleInfo, cyclePoints, cycleRangeFor, pointsForDay } from './cycle';

test('the anchor day is cycle 1, day 1', () => {
  assert.deepEqual(cycleInfo('2026-10-08'), {
    cycleNumber: 1,
    dayInCycle: 1,
    daysLeft: 29,
    startKey: '2026-10-08',
    endKey: '2026-11-06',
  });
});

test('2026-11-06 is the last day of cycle 1', () => {
  const info = cycleInfo('2026-11-06');
  assert.equal(info.cycleNumber, 1);
  assert.equal(info.dayInCycle, 30);
  assert.equal(info.daysLeft, 0);
});

test('2026-11-07 is cycle 2, day 1', () => {
  assert.deepEqual(cycleInfo('2026-11-07'), {
    cycleNumber: 2,
    dayInCycle: 1,
    daysLeft: 29,
    startKey: '2026-11-07',
    endKey: '2026-12-06',
  });
});

test('dates before the anchor fall into cycle 0 and below', () => {
  // The day before the anchor is the last day of cycle 0.
  assert.deepEqual(cycleInfo('2026-10-07'), {
    cycleNumber: 0,
    dayInCycle: 30,
    daysLeft: 0,
    startKey: '2026-09-08',
    endKey: '2026-10-07',
  });
  // 31 days before the anchor is already in cycle -1.
  assert.equal(cycleInfo('2026-09-07').cycleNumber, -1);
  assert.equal(cycleInfo('2026-09-07').dayInCycle, 30);
});

test('cycle boundaries are not shifted by daylight saving or year ends', () => {
  // Cycle 1 spans the late-October DST change in Europe and the early-
  // November one in the US; cycle 3 crosses the year boundary.
  assert.deepEqual(cycleRangeFor(3), { startKey: '2026-12-07', endKey: '2027-01-05' });
  assert.equal(cycleInfo('2027-01-05').dayInCycle, 30);
  assert.equal(cycleInfo('2027-01-06').cycleNumber, 4);
});

test('pointsForDay adds the base to a 0-100 average', () => {
  assert.equal(pointsForDay(0), 50);
  assert.equal(pointsForDay(100), 150);
  assert.equal(pointsForDay(73), 123);
});

test('pointsForDay rounds the average and clamps out-of-range values', () => {
  assert.equal(pointsForDay(72.5), 123);
  assert.equal(pointsForDay(-20), 50);
  assert.equal(pointsForDay(250), 150);
  assert.equal(pointsForDay(Number.NaN), 50);
});

test('every badge threshold: just below and exactly at the limit', () => {
  assert.equal(badgeForPoints(0), null);
  assert.equal(badgeForPoints(949), null);
  assert.equal(badgeForPoints(950), 'bronze');
  assert.equal(badgeForPoints(1899), 'bronze');
  assert.equal(badgeForPoints(1900), 'silver');
  assert.equal(badgeForPoints(2799), 'silver');
  assert.equal(badgeForPoints(2800), 'gold');
  assert.equal(badgeForPoints(3749), 'gold');
  assert.equal(badgeForPoints(3750), 'diamond');
  assert.equal(badgeForPoints(4500), 'diamond');
});

test('cyclePoints skips missed days, counts a date_key once, and ignores other cycles', () => {
  const rows = [
    { date_key: '2026-10-08', average: 80 }, // 130
    // 2026-10-09 missed: no row, adds 0
    { date_key: '2026-10-10', average: 40 }, // 90
    { date_key: '2026-10-10', average: 99 }, // duplicate date_key: ignored
    { date_key: '2026-11-06', average: 100 }, // last day of cycle 1: 150
    { date_key: '2026-10-07', average: 100 }, // cycle 0: ignored
    { date_key: '2026-11-07', average: 100 }, // cycle 2: ignored
  ];
  assert.equal(cyclePoints(rows, 1), 130 + 90 + 150);
  assert.equal(cyclePoints(rows, 2), 150);
  assert.equal(cyclePoints([], 1), 0);
});

test('a perfect cycle maxes out at 4500 points', () => {
  const { startKey } = cycleRangeFor(1);
  const [year, month, day] = startKey.split('-').map(Number);
  const rows = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, day + i));
    return { date_key: date.toISOString().slice(0, 10), average: 100 };
  });
  assert.equal(cyclePoints(rows, 1), 4500);
});
