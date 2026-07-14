import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { scopedStorageKey } from '../lib/accountStorage';
import { useAuth } from './AuthContext';

// Where the day-by-day history is saved on device, so it survives the
// app closing. Suffixed per signed-in account (see lib/accountStorage.ts)
// so one phone switching between accounts — or between an account and
// anonymous play — never bleeds one identity's history into another's.
const BASE_STORAGE_KEY = 'colorhunt.history';

export type DayOutcome = 'passed' | 'failed';

// Everything the Calendar and the day-detail view need to fully
// reconstruct a past day: what the target color was, how each photo
// scored, and the photos themselves.
export type DayRecord = {
  outcome: DayOutcome;
  hex: string;
  hue: number;
  saturation: number;
  lightness: number;
  scores: number[];
  // Parallel to `scores` — same length, same index order.
  photoUris: string[];
  // Epoch ms this record was last written locally. Used only for cloud
  // sync's "newest wins" merge (see context/SyncContext.tsx) — nothing
  // else in the app reads it.
  updatedAt: number;
};

// Keyed by "YYYY-MM-DD" (local time) — the same date-key shape used by
// RoundContext and StreakContext.
export type StoredHistory = Record<string, DayRecord>;

type HistoryContextValue = {
  history: StoredHistory;
  isLoaded: boolean;
  // Records (or overwrites) the full record for a given day, stamping it
  // with the current time, and returns the stored record so a caller
  // (see app/summary.tsx) can hand the exact same object to cloud sync.
  // Safe to call more than once for the same day — it's just the latest
  // value that sticks, so re-showing a result screen (or retrying a
  // round) never corrupts anything.
  recordDay: (dateKey: string, record: Omit<DayRecord, 'updatedAt'>) => DayRecord;
  // Folds cloud-sourced records into local history: a day is only
  // overwritten if it's missing locally or the incoming copy is newer,
  // so a fresher local record (e.g. one not yet uploaded) never loses to
  // a stale cloud read. See context/SyncContext.tsx.
  mergeRecords: (incoming: StoredHistory) => void;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

// A real, on-device record of every day's round — color, scores, and
// photos — so the Calendar screen can highlight past passed/failed days
// (and show a detail view for any of them) instead of only knowing
// about today (see context/StreakContext.tsx for the same "honest,
// local-only stepping stone" reasoning).
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: isAuthLoaded } = useAuth();
  const storageKey = scopedStorageKey(BASE_STORAGE_KEY, user?.id ?? null);

  const [history, setHistory] = useState<StoredHistory>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Re-runs every time `storageKey` changes — i.e. every time the signed-
  // in identity changes — resetting to empty *before* loading the new
  // bucket, so the previous identity's history is never visible even for
  // a frame. Waits for auth to finish restoring its own session first
  // (isAuthLoaded) so this doesn't briefly load the anonymous bucket only
  // to immediately swap to the real one once a saved session comes back.
  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    setIsLoaded(false);
    setHistory({});

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!cancelled && raw) {
          const stored: StoredHistory = JSON.parse(raw);
          // Records saved before cloud sync existed have no `updatedAt`.
          // Backfilling 0 (not "now") marks them as old rather than
          // freshly-changed, so a same-day cloud copy from elsewhere
          // correctly wins — while a day that exists only locally still
          // uploads regardless, since pickRecordsNewerOrEqual treats
          // "missing from the cloud" as reason enough on its own.
          for (const record of Object.values(stored)) {
            record.updatedAt ??= 0;
          }
          setHistory(stored);
        }
      } catch {
        // Unreadable/corrupt storage just starts with an empty history.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storageKey, isAuthLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(history)).catch(() => {
      // Non-fatal: history just won't survive an app restart this time.
    });
  }, [history, isLoaded, storageKey]);

  const value = useMemo<HistoryContextValue>(
    () => ({
      history,
      isLoaded,
      recordDay: (dateKey: string, record: Omit<DayRecord, 'updatedAt'>) => {
        const stamped: DayRecord = { ...record, updatedAt: Date.now() };
        setHistory((current) => ({ ...current, [dateKey]: stamped }));
        return stamped;
      },
      mergeRecords: (incoming: StoredHistory) => {
        setHistory((current) => {
          let next = current;
          for (const [dateKey, record] of Object.entries(incoming)) {
            const existing = next[dateKey];
            if (!existing || record.updatedAt > existing.updatedAt) {
              // Only allocate a new object the first time this call
              // actually changes something, so an incoming batch with
              // nothing newer than what's local doesn't churn `history`'s
              // identity for no reason.
              if (next === current) next = { ...current };
              next[dateKey] = record;
            }
          }
          return next;
        });
      },
    }),
    [history, isLoaded]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
