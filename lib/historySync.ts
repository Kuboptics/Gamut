// Talks to the `round_results` table in Supabase (see the SQL in
// CLAUDE.md/the Stage 3 setup notes for the table + RLS policies). Pure
// network functions — no React here; context/SyncContext.tsx decides when
// to call these and how to handle a failure (offline, etc).

import type { DayRecord, StoredHistory } from '../context/HistoryContext';
import { nameColor } from './colorName';
import { supabase } from './supabase';

const TABLE = 'round_results';

// The shape of one row in Supabase — snake_case columns, dates as ISO
// strings, matching Postgres/PostgREST conventions rather than the local
// camelCase DayRecord shape.
type CloudRow = {
  date_key: string;
  hex: string;
  color_name: string;
  hue: number;
  saturation: number;
  lightness: number;
  scores: number[];
  average: number;
  outcome: DayRecord['outcome'];
  updated_at: string;
};

function average(scores: number[]): number {
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function toCloudRow(userId: string, dateKey: string, record: DayRecord): CloudRow & { user_id: string } {
  return {
    user_id: userId,
    date_key: dateKey,
    hex: record.hex,
    color_name: nameColor(record.hue, record.saturation, record.lightness),
    hue: record.hue,
    saturation: record.saturation,
    lightness: record.lightness,
    scores: record.scores,
    average: average(record.scores),
    outcome: record.outcome,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

// Cloud rows never carry photos (see the Stage 3 plan's data-model
// notes) — photoUris always comes back empty for a day pulled from
// another device.
function fromCloudRow(row: CloudRow): DayRecord {
  return {
    outcome: row.outcome,
    hex: row.hex,
    hue: row.hue,
    saturation: row.saturation,
    lightness: row.lightness,
    scores: row.scores,
    photoUris: [],
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function fetchCloudHistory(userId: string): Promise<StoredHistory> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
  if (error) throw error;

  const history: StoredHistory = {};
  for (const row of data as CloudRow[]) {
    history[row.date_key] = fromCloudRow(row);
  }
  return history;
}

export async function upsertCloudRecords(
  userId: string,
  entries: { dateKey: string; record: DayRecord }[]
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map(({ dateKey, record }) => toCloudRow(userId, dateKey, record));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,date_key' });
  if (error) throw error;
}

// Which local days should be pushed up: missing from the cloud entirely,
// or locally at least as new as the cloud's copy. This is the client-side
// half of "newest wins" — HistoryContext.mergeRecords is the other half,
// deciding what to keep locally.
export function pickRecordsNewerOrEqual(
  local: StoredHistory,
  cloud: StoredHistory
): { dateKey: string; record: DayRecord }[] {
  const entries: { dateKey: string; record: DayRecord }[] = [];
  for (const [dateKey, record] of Object.entries(local)) {
    const cloudRecord = cloud[dateKey];
    if (!cloudRecord || record.updatedAt >= cloudRecord.updatedAt) {
      entries.push({ dateKey, record });
    }
  }
  return entries;
}
