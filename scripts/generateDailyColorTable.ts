// Run with: npm run generate:daily-colors
//
// Regenerates assets/dailyColorTable.json — the committed, 10-year table
// of daily colors lib/dailyColor.ts reads from at runtime. Only rerun
// this after a deliberate change to the guard algorithm in
// dailyColorTableCore.ts (thresholds, retry schedule, generator formula),
// and check the "table is append-only" test in
// scripts/dailyColorTableCore.test.ts still passes afterward — it fails
// on purpose if regenerating would rewrite a date that's already
// committed (and so may already have been shown to a player).

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUARD_EPOCH_DATE, TABLE_DAYS, TABLE_YEARS } from '../lib/dailyColor';
import { generateDailyColorTable } from './dailyColorTableCore';

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'dailyColorTable.json');

const startTime = performance.now();
const table = generateDailyColorTable();
const elapsedMs = performance.now() - startTime;

writeFileSync(outPath, JSON.stringify(table));

console.log(
  `Wrote ${table.length} days (${TABLE_YEARS} years from ${GUARD_EPOCH_DATE}, expected ${TABLE_DAYS}) to ${outPath} in ${elapsedMs.toFixed(0)}ms`
);
