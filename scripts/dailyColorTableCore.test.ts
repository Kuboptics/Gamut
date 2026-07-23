import assert from 'node:assert/strict';
import { test } from 'node:test';
import dailyColorTable from '../assets/dailyColorTable.json';
import { MIN_DELTA_E, MIN_HUE_SEPARATION_FROM_YESTERDAY, deltaE2000, generateDailyColorTable, oklchHueSeparation } from './dailyColorTableCore';

// Note: an earlier design persisted resolved days to AsyncStorage, tagged
// with an ALGORITHM_VERSION so a stale/mismatched cache could be
// discarded and re-derived (see the version-mismatch and
// wrong-colors-in-a-matching-version tests that design called for). That
// whole persistence layer — hydrateRecentHistory, persistRecentHistory,
// ALGORITHM_VERSION, the timeout race — was removed in favor of the
// precomputed table below, which has no runtime cache and nothing to
// version-tag: assets/dailyColorTable.json is regenerated (and reviewed
// as a diff) by a human running scripts/generateDailyColorTable.ts, not
// silently discarded and rebuilt by a client at runtime. Those two tests
// don't apply to anything that still exists in this codebase.

test('deltaE2000 rejects a near-identical hex pair', () => {
  const distance = deltaE2000('#3A7FD5', '#3B80D6');
  assert.ok(distance < MIN_DELTA_E, `expected near-identical colors to read as too similar (< ${MIN_DELTA_E}), got ${distance}`);
});

test('deltaE2000 accepts a clearly distinct hex pair', () => {
  const distance = deltaE2000('#FF0000', '#00FFFF'); // red vs. cyan
  assert.ok(distance >= MIN_DELTA_E, `expected red vs. cyan to clear ${MIN_DELTA_E}, got ${distance}`);
});

test('oklchHueSeparation rejects two hues that are barely apart', () => {
  const separation = oklchHueSeparation('#3A7FD5', '#3B80D6');
  assert.ok(
    separation < MIN_HUE_SEPARATION_FROM_YESTERDAY,
    `expected near-identical hues to be under ${MIN_HUE_SEPARATION_FROM_YESTERDAY}°, got ${separation}`
  );
});

test('oklchHueSeparation accepts two clearly different hues', () => {
  const separation = oklchHueSeparation('#FF0000', '#00FFFF'); // red vs. cyan
  assert.ok(
    separation >= MIN_HUE_SEPARATION_FROM_YESTERDAY,
    `expected red vs. cyan hue separation to clear ${MIN_HUE_SEPARATION_FROM_YESTERDAY}°, got ${separation}`
  );
});

// This is the guarantee that matters most: assets/dailyColorTable.json is
// committed to version control and shown to real players, so an entry
// that's already in it must never change underneath them — even if
// someone later tweaks a constant above and reruns the generator without
// noticing the table already covers that date. Regenerating is allowed to
// *add* new days past the committed table's current length (that's the
// normal "extend coverage before it runs out" maintenance), but every
// index the committed file already has must come back byte-identical.
//
// If this test ever fails, the fix is almost never "update the test" —
// it means something changed the algorithm in a way that would rewrite a
// date that may already have been played, which is exactly what
// GUARD_EPOCH_DATE and this whole table exist to prevent.
test('regenerating the table reproduces every already-committed entry byte-identically', () => {
  const regenerated = generateDailyColorTable();

  assert.ok(
    regenerated.length >= dailyColorTable.length,
    `regenerated table (${regenerated.length} days) is shorter than the committed one (${dailyColorTable.length} days) — the committed file covers dates the current generator no longer produces`
  );

  for (let i = 0; i < dailyColorTable.length; i++) {
    assert.equal(
      regenerated[i],
      dailyColorTable[i],
      `index ${i} changed on regeneration: committed ${dailyColorTable[i]}, regenerated ${regenerated[i]} — this would rewrite a date that may already have been shown to a player`
    );
  }
});
