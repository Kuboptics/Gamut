import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { scopedStorageKey } from '../lib/accountStorage';
import { useAuth } from './AuthContext';

// Where the streak is saved on device, so it survives the app closing.
// Suffixed per signed-in account (see lib/accountStorage.ts) so switching
// accounts on one phone — or between an account and anonymous play —
// never bleeds one identity's streak into another's.
const BASE_STORAGE_KEY = 'colorhunt.streak';

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
  const { user, isLoaded: isAuthLoaded } = useAuth();
  const storageKey = scopedStorageKey(BASE_STORAGE_KEY, user?.id ?? null);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [lastPassedDateKey, setLastPassedDateKey] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Re-runs whenever the signed-in identity changes, resetting to zero
  // before loading the new bucket — see HistoryContext for the same
  // pattern and why it waits for isAuthLoaded first.
  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    setIsLoaded(false);
    setCurrentStreak(0);
    setLastPassedDateKey(null);

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
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
  }, [storageKey, isAuthLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    const stored: StoredStreak = { currentStreak, lastPassedDateKey };
    AsyncStorage.setItem(storageKey, JSON.stringify(stored)).catch(() => {
      // Non-fatal: the streak just won't survive an app restart this time.
    });
  }, [currentStreak, lastPassedDateKey, isLoaded, storageKey]);

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
