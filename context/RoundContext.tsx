import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// A round is 3 photos against today's color; the round passes if the
// average of the 3 scores is at least this percentage.
export const PHOTOS_PER_ROUND = 3;
export const PASS_THRESHOLD = 60;

type RoundContextValue = {
  scores: number[];
  submitScore: (score: number) => void;
  resetRound: () => void;
};

const RoundContext = createContext<RoundContextValue | null>(null);

// Holds the running list of per-photo scores for the current round.
// Lives above the navigation stack (see app/_layout.tsx) so it survives
// moving between the Capture and Result screens across all 3 shots.
export function RoundProvider({ children }: { children: ReactNode }) {
  const [scores, setScores] = useState<number[]>([]);

  const value = useMemo<RoundContextValue>(
    () => ({
      scores,
      submitScore: (score: number) => setScores((previous) => [...previous, score]),
      resetRound: () => setScores([]),
    }),
    [scores]
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
