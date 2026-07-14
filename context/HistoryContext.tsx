import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Where the day-by-day history is saved on device, so it survives the
// app closing.
const STORAGE_KEY = 'colorhunt.history';

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
};

// Keyed by "YYYY-MM-DD" (local time) — the same date-key shape used by
// RoundContext and StreakContext.
type StoredHistory = Record<string, DayRecord>;

type HistoryContextValue = {
  history: StoredHistory;
  isLoaded: boolean;
  // Records (or overwrites) the full record for a given day. Safe to
  // call more than once for the same day — it's just the latest value
  // that sticks, so re-showing a result screen (or retrying a round)
  // never corrupts anything.
  recordDay: (dateKey: string, record: DayRecord) => void;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

// A real, on-device record of every day's round — color, scores, and
// photos — so the Calendar screen can highlight past passed/failed days
// (and show a detail view for any of them) instead of only knowing
// about today (see context/StreakContext.tsx for the same "honest,
// local-only stepping stone" reasoning).
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<StoredHistory>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          setHistory(JSON.parse(raw));
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
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history)).catch(() => {
      // Non-fatal: history just won't survive an app restart this time.
    });
  }, [history, isLoaded]);

  const value = useMemo<HistoryContextValue>(
    () => ({
      history,
      isLoaded,
      recordDay: (dateKey: string, record: DayRecord) => {
        setHistory((current) => {
          // Bail out with the same object if nothing's actually
          // changing. Returning a new object every call — even for an
          // unchanged value — would change `history`'s identity, which
          // would change this function's identity (see the `value`
          // useMemo below), which could re-trigger an effect that
          // calls recordDay again. Skipping the no-op update keeps
          // everything stable.
          if (JSON.stringify(current[dateKey]) === JSON.stringify(record)) return current;
          return { ...current, [dateKey]: record };
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
