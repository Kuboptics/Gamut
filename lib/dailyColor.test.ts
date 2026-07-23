import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deltaE2000 } from '../scripts/dailyColorTableCore';
import dailyColorTable from '../assets/dailyColorTable.json';
import { hexToRgb, rgbToHsl } from './color';
import { GUARD_EPOCH_DATE, TABLE_DAYS, baseCandidate, dateToSeedString, getDailyTarget } from './dailyColor';

function dateFromEpochOffset(daysAfterEpoch: number): Date {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  return new Date(year, month - 1, day + daysAfterEpoch);
}

test('a date on or before GUARD_EPOCH_DATE returns the plain, unguarded formula', () => {
  const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
  const epochDate = new Date(year, month - 1, day);
  const expected = baseCandidate(dateToSeedString(epochDate), 0);
  assert.deepEqual(getDailyTarget(epochDate), expected);
});

test('an in-range date matches the committed table, correctly reconstructed', () => {
  // Index 200 is well inside the table, away from either edge.
  const date = dateFromEpochOffset(201); // epoch + 1 (first guarded date) + 200
  const result = getDailyTarget(date);
  const tableHex = dailyColorTable[200];

  assert.equal(result.hex, tableHex);
  assert.deepEqual(result.rgb, hexToRgb(tableHex));
  const { h, s, l } = rgbToHsl(result.rgb);
  assert.equal(result.hue, h);
  assert.equal(result.saturation, s);
  assert.equal(result.lightness, l);
});

test('consecutive in-range days never land too close together', () => {
  const SAMPLE_DAYS = 400;
  let previous = getDailyTarget(dateFromEpochOffset(1));
  for (let i = 2; i <= SAMPLE_DAYS; i++) {
    const current = getDailyTarget(dateFromEpochOffset(i));
    const distance = deltaE2000(current.hex, previous.hex);
    assert.ok(distance >= 10, `day ${i} (${current.hex}) landed within ${distance} of the previous day (${previous.hex})`);
    previous = current;
  }
});

test('the table index a date maps to is immune to DST transitions', () => {
  // The table index is derived by feeding *local calendar components*
  // (getFullYear/getMonth/getDate) into Date.UTC (see
  // daysSinceFirstGuardedDate in dailyColor.ts) — never by subtracting
  // two local Date .getTime() values directly. That distinction matters:
  // a DST "spring forward" day is only 23 real hours long, so naive
  // millisecond subtraction across one (168hrs -> divided by 24hrs/day)
  // can drift by a day depending on how the remainder is handled. Prove
  // it by actually running through a real DST transition, rather than
  // just asserting the implementation looks right.
  const originalTZ = process.env.TZ;
  process.env.TZ = 'America/New_York'; // observes DST; US 2027 spring-forward is March 14

  try {
    const mar13 = new Date(2027, 2, 13); // 00:00 EST, the day before the transition
    const mar14 = new Date(2027, 2, 14); // the 23-hour transition day itself
    const mar15 = new Date(2027, 2, 15); // 00:00 EDT, the day after

    // Confirms Node is actually observing the DST transition in this
    // process before trusting the rest of the test — if this ever isn't
    // true (e.g. no tzdata for America/New_York), the real assertions
    // below wouldn't be testing anything.
    assert.notEqual(mar13.getTimezoneOffset(), mar15.getTimezoneOffset(), 'expected a DST offset change between these two dates');

    const hex13 = getDailyTarget(mar13).hex;
    const hex14 = getDailyTarget(mar14).hex;
    const hex15 = getDailyTarget(mar15).hex;

    // Ground truth: step through calendar dates one at a time via
    // setDate/getDate (never getTime()/ms math), which is correct by
    // construction regardless of DST — then read those same three table
    // entries directly, independent of getDailyTarget's own index math.
    const [year, month, day] = GUARD_EPOCH_DATE.split('-').map(Number);
    const cursor = new Date(year, month - 1, day + 1); // the first guarded date = table index 0
    let index = 0;
    while (cursor.getTime() < new Date(2027, 2, 13).getTime()) {
      cursor.setDate(cursor.getDate() + 1);
      index++;
    }

    assert.equal(hex13, dailyColorTable[index], 'March 13 landed on the wrong table index');
    assert.equal(hex14, dailyColorTable[index + 1], 'March 14 (the DST transition day) landed on the wrong table index');
    assert.equal(hex15, dailyColorTable[index + 2], 'March 15 landed on the wrong table index');
  } finally {
    process.env.TZ = originalTZ;
  }
});

test('a date past the end of the table falls back to the plain formula and logs loudly', () => {
  const originalError = console.error;
  let loggedMessage: string | undefined;
  console.error = (message: string) => {
    loggedMessage = message;
  };

  try {
    const outOfRangeDate = dateFromEpochOffset(TABLE_DAYS + 10);
    const result = getDailyTarget(outOfRangeDate);
    const expected = baseCandidate(dateToSeedString(outOfRangeDate), 0);

    assert.deepEqual(result, expected, 'out-of-range dates should fall back to the plain, unguarded formula');
    assert.ok(loggedMessage, 'an out-of-range date should log loudly via console.error');
    assert.match(loggedMessage!, /outside the precomputed table/);
  } finally {
    console.error = originalError;
  }
});
