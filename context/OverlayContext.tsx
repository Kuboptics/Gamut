import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type OverlayContextValue = {
  // True while any modal/overlay is on screen — not specific to any one
  // modal. Lets a tab-root screen's useTabSwipe (see hooks/useTabSwipe.ts)
  // stop claiming horizontal swipes for itself while something rendered
  // on top of it is handling its own gesture instead (see
  // PhotoViewerModal.tsx for the first caller).
  isOverlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

// Tracks whether any modal/overlay is currently open, app-wide. A modal
// calls setOverlayOpen(true) when it opens and setOverlayOpen(false)
// whenever it closes — including on unmount, so the flag can never get
// stuck true if a modal disappears some other way than its own close
// path. Any future modal can share this same flag; it isn't wired to one
// specific overlay.
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [isOverlayOpen, setOverlayOpen] = useState(false);
  const value = useMemo<OverlayContextValue>(() => ({ isOverlayOpen, setOverlayOpen }), [isOverlayOpen]);
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}
