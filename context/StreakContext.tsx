import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Where the streak is saved on device, so it survives the app closing.
const STORAGE_KEY = 'colorhunt.streak';

type StoredStreak = {
  currentStreak: number;
  lastPassedDateKey: string | null;
};

type StreakContextValue = {
  currentStreak: number;
  isLoaded: boolean;
  // Call when a round is passed. Safe to call more than once for the
  // same day — only the first call each day actually changes anything.
  recordPass: () => void;
};

const StreakContext = createContext<StreakContextValue | null>(null);

function dateKeyFor(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey(): string {
  return dateKeyFor(new Date());
}

function yesterdayKey(): string {
  const now = new Date();
  return dateKeyFor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

// A simple local streak counter: consecutive days with at least one
// passed round. This is intentionally local-only (no account, no
// server) — a real synced streak is a Phase 3 feature once accounts
// exist; this is an honest, smaller stepping stone rather than fake data.
export function StreakProvider({ children }: { children: ReactNode }) {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [lastPassedDateKey, setLastPassedDateKey] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const stored: StoredStreak = JSON.parse(raw);
          setCurrentStreak(stored.currentStreak);
          setLastPassedDateKey(stored.lastPassedDateKey);
        }
      } catch {
        // Unreadable/corrupt storage just starts the streak from zero.
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
    const stored: StoredStreak = { currentStreak, lastPassedDateKey };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {
      // Non-fatal: the streak just won't survive an app restart this time.
    });
  }, [currentStreak, lastPassedDateKey, isLoaded]);

  const value = useMemo<StreakContextValue>(
    () => ({
      currentStreak,
      isLoaded,
      recordPass: () => {
        const today = todayKey();
        if (lastPassedDateKey === today) return; // already recorded today
        const isConsecutive = lastPassedDateKey === yesterdayKey();
        setCurrentStreak(isConsecutive ? currentStreak + 1 : 1);
        setLastPassedDateKey(today);
      },
    }),
    [currentStreak, lastPassedDateKey, isLoaded]
  );

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak(): StreakContextValue {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error('useStreak must be used within a StreakProvider');
  }
  return context;
}
