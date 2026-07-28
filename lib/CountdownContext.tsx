import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { msUntilNextMidnight } from './countdown';

const CountdownContext = createContext<number | null>(null);

// The single countdown-to-next-drop timer for the whole app — ticks once a
// second here and every screen reads the current value via useCountdown().
// Moved out of app/(tabs)/_layout.tsx so NativeTabs can be the top-level
// element there (a plain context provider renders nothing itself, so it
// can't displace the native tab bar the way a header View used to).
export function CountdownProvider({ children }: { children: ReactNode }) {
  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <CountdownContext.Provider value={countdownMs}>{children}</CountdownContext.Provider>;
}

export function useCountdown(): number {
  const countdownMs = useContext(CountdownContext);
  if (countdownMs === null) {
    throw new Error('useCountdown must be used within a CountdownProvider');
  }
  return countdownMs;
}
