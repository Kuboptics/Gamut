import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// A round is 3 photos against today's color; the round passes if the
// average of the 3 scores is at least this percentage.
export const PHOTOS_PER_ROUND = 3;
export const PASS_THRESHOLD = 60;

// Where the in-progress round is saved on device, so it survives the
// app being fully closed (not just backgrounded).
const STORAGE_KEY = 'colorhunt.round';

// How often to check whether the calendar day has rolled over while the
// app stays open (so a round doesn't linger into a new day's color).
const DAY_CHECK_INTERVAL_MS = 30000;

type StoredRound = {
  dateKey: string;
  scores: number[];
};

type RoundContextValue = {
  scores: number[];
  // False until the persisted round has been read from storage, so
  // screens can avoid flashing "0 of 3" before a saved round loads.
  isLoaded: boolean;
  // Records a photo's score and returns the new banked count.
  bankPhoto: (score: number) => number;
  resetRound: () => void;
};

const RoundContext = createContext<RoundContextValue | null>(null);

// A YYYY-MM-DD key in local time — matches lib/dailyColor.ts's own date
// key, so "today" means the same thing in both places.
function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Holds the running list of per-photo scores for the current round, and
// persists them to AsyncStorage so a round can be spread across a whole
// day, closing and reopening the app between shots. Lives above the
// navigation stack (see app/_layout.tsx) so it also survives moving
// between the Capture and Preview screens.
export function RoundProvider({ children }: { children: ReactNode }) {
  const [scores, setScores] = useState<number[]>([]);
  const [dateKey, setDateKey] = useState(todayKey);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load any in-progress round from device storage once, on launch.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const stored: StoredRound = JSON.parse(raw);
          // Only resume a round that belongs to today's color — a
          // round saved on a previous day starts fresh instead.
          if (stored.dateKey === todayKey()) {
            setScores(stored.scores);
          }
        }
      } catch {
        // Unreadable/corrupt storage just starts a fresh round.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist whenever scores change, but only after the initial load has
  // happened — otherwise we'd briefly overwrite real saved progress
  // with an empty round before it's had a chance to load.
  useEffect(() => {
    if (!isLoaded) return;
    const stored: StoredRound = { dateKey, scores };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {
      // Non-fatal: progress just won't survive an app restart this time.
    });
  }, [scores, dateKey, isLoaded]);

  // If the app is left open across local midnight, today's target color
  // changes underneath the round — check periodically and reset if so.
  useEffect(() => {
    const interval = setInterval(() => {
      const key = todayKey();
      if (key !== dateKey) {
        setDateKey(key);
        setScores([]);
      }
    }, DAY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dateKey]);

  const value = useMemo<RoundContextValue>(
    () => ({
      scores,
      isLoaded,
      bankPhoto: (score: number) => {
        const next = [...scores, score];
        setScores(next);
        return next.length;
      },
      resetRound: () => setScores([]),
    }),
    [scores, isLoaded]
  );

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>;
}

export function useRound(): RoundContextValue {
  const context = useContext(RoundContext);
  if (!context) {
    throw new Error('useRound must be used within a RoundProvider');
  }
  return context;
}
