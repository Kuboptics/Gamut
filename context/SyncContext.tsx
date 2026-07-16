import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './AuthContext';
import { useHistory, type DayRecord } from './HistoryContext';
import { fetchCloudHistory, pickRecordsNewerOrEqual, upsertCloudRecords } from '../lib/historySync';
import { uploadThumbnails } from '../lib/thumbnails';

type SyncContextValue = {
  // Fire-and-forget upload for one day's record, called right after
  // HistoryContext.recordDay so a freshly completed (or retried) round
  // reaches the cloud immediately. Silently does nothing while signed out
  // or offline — local storage already has the real, authoritative copy
  // either way.
  pushRecord: (dateKey: string, record: DayRecord) => void;
  // Fire-and-forget upload of a round's 3 shots as small thumbnails, for
  // the friends leaderboard. Same no-op-when-signed-out/offline shape as
  // pushRecord, but with no retry-on-reconnect: thumbnails are purely
  // supplementary, so a missed upload just means friends don't see
  // squares for today, and it self-heals the next time this account
  // plays (see lib/thumbnails.ts for why that's an acceptable tradeoff).
  pushThumbnails: (photoUris: string[]) => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

// Glues AuthContext and HistoryContext together so neither has to know
// the other exists. Purely local-history <-> Supabase plumbing — no
// friends/social data yet.
export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { history, isLoaded: historyLoaded, mergeRecords } = useHistory();

  // Keeps the latest local history readable from inside effects/callbacks
  // below without needing them to re-run every time a day is recorded.
  const historyRef = useRef(history);
  historyRef.current = history;

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !historyLoaded) return;

    let cancelled = false;

    async function syncNow() {
      try {
        const cloudHistory = await fetchCloudHistory(userId!);
        if (cancelled) return;
        // Snapshot local *before* merging in the cloud's copy, so we know
        // exactly which days were locally authoritative going into it.
        const localBeforeMerge = historyRef.current;
        mergeRecords(cloudHistory);
        const toUpload = pickRecordsNewerOrEqual(localBeforeMerge, cloudHistory);
        if (toUpload.length > 0) {
          await upsertCloudRecords(userId!, toUpload);
        }
      } catch {
        // Offline or the request failed — local data is untouched; the
        // next sign-in or app-foreground retries.
      }
    }

    syncNow();

    // Retries the same sync whenever the app comes back to the
    // foreground, so being offline at sign-in doesn't block sync forever
    // — no network-status library needed, just an opportunistic retry.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId, historyLoaded, mergeRecords]);

  const value = useMemo<SyncContextValue>(
    () => ({
      pushRecord: (dateKey, record) => {
        if (!userId) return;
        upsertCloudRecords(userId, [{ dateKey, record }]).catch(() => {
          // Offline/failed — the record is already correct locally, and
          // it's the newest copy for that day, so the next sync pass will
          // pick it up and upload it then.
        });
      },
      pushThumbnails: (photoUris) => {
        if (!userId) return;
        uploadThumbnails(userId, photoUris).catch(() => {
          // Offline/failed — no retry. See the type's doc comment above.
        });
      },
    }),
    [userId]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
