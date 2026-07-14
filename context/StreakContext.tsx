import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { computeStreak } from '../lib/streak';
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

  const currentStreak = useMemo(() => computeStreak(Object.keys(history).sort()), [history]);

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
