import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { computeStreak, todayKey } from '../lib/streak';
import { useHistory } from './HistoryContext';

type StreakContextValue = {
  currentStreak: number;
  isLoaded: boolean;
};

const StreakContext = createContext<StreakContextValue | null>(null);

// The streak is a pure derived value from HistoryContext — every played
// day (pass or fail) extends it, only a fully skipped day breaks it —
// rather than a separately persisted counter. HistoryContext is already
// the one per-account-scoped, cloud-synced record of what actually
// happened each day, so deriving from it (instead of keeping a second,
// independently-updated number) means the Progress tab and the friends
// leaderboard can never quietly drift apart — see lib/streak.ts, shared
// by both.
export function StreakProvider({ children }: { children: ReactNode }) {
  const { history, isLoaded } = useHistory();

  // computeStreak needs to know "today" to tell a live streak from one
  // that quietly broke while the app sat closed. Re-reading it whenever
  // the app returns to the foreground (not just when history changes)
  // means a missed day is reflected the moment you open the app again,
  // rather than only after your next completed round.
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayKey());
    });
    return () => subscription.remove();
  }, []);

  const currentStreak = useMemo(() => computeStreak(Object.keys(history).sort(), today), [history, today]);

  // A light tap the moment the streak grows — not on every render of the
  // same value, and not for the very first value we ever compute (that's
  // just this account's existing streak loading in, not a fresh extend).
  const previousStreakRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    const previous = previousStreakRef.current;
    if (previous !== null && currentStreak > previous) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    previousStreakRef.current = currentStreak;
  }, [currentStreak, isLoaded]);

  const value = useMemo<StreakContextValue>(() => ({ currentStreak, isLoaded }), [currentStreak, isLoaded]);

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak(): StreakContextValue {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error('useStreak must be used within a StreakProvider');
  }
  return context;
}
