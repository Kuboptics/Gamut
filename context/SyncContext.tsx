import { File } from 'expo-file-system';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './AuthContext';
import { useHistory, type DayRecord, type StoredHistory } from './HistoryContext';
import { fetchCloudHistory, pickRecordsNewerOrEqual, upsertCloudRecords } from '../lib/historySync';
import { uploadThumbnails } from '../lib/thumbnails';
import { getThumbnailUploadMarker, setThumbnailUploadMarker } from '../lib/thumbnailUploadStatus';

type SyncContextValue = {
  // Fire-and-forget upload for one day's record, called right after
  // HistoryContext.recordDay so a freshly completed (or retried) round
  // reaches the cloud immediately. Silently does nothing while signed out
  // or offline — local storage already has the real, authoritative copy
  // either way.
  pushRecord: (dateKey: string, record: DayRecord) => void;
  // Upload of a round's 3 shots as small thumbnails, for the friends
  // leaderboard. Same no-op-when-signed-out shape as pushRecord. Unlike
  // before, a failure here *is* retried on the next foreground — see the
  // syncNow effect below — because thumbnails don't self-heal the way
  // round_results does (a synced round_results row never carries photos,
  // so there's nothing else that would re-upload them). Returns a promise
  // so the caller (app/summary.tsx) can track whether this specific
  // attempt succeeded, but callers are never required to await it.
  pushThumbnails: (photoUris: string[]) => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

// Foreground self-heal for a thumbnail upload that silently failed at
// submit time — the same idea as the record reconciliation above, but
// for thumbnails, which don't otherwise get a second chance (see the
// pushThumbnails doc comment). Only ever acts on the single most recent
// local round: if the marker's dateKey isn't the latest one in history,
// this does nothing, since the thumbnails bucket only ever holds one
// round's photos and re-uploading an older day would overwrite today's
// correct ones — e.g. after cloud sync (mergeRecords) brings in a newer
// day recorded on another device while this device's marker still points
// at an older, locally-failed upload. That means an old failure can go
// unretried and eventually get silently overwritten by the next round's
// marker (see app/summary.tsx) — a known, accepted gap, not a bug in this
// function. Also bails out if the round's photo files are gone (e.g.
// cleaned up) rather than uploading nothing — every skip below is now
// logged instead of silent, so a real-device log shows exactly which one
// fired.
async function retryThumbnailUploadIfNeeded(userId: string, history: StoredHistory): Promise<void> {
  const marker = await getThumbnailUploadMarker(userId);
  const dateKeys = Object.keys(history).sort();
  const latestDateKey = dateKeys[dateKeys.length - 1];

  if (!marker || marker.uploaded) {
    console.log('[SyncContext] thumbnail retry: nothing pending', { marker, latestDateKey });
    return;
  }

  if (marker.dateKey !== latestDateKey) {
    console.log('[SyncContext] thumbnail retry: marker date is not the latest day, skipping', {
      marker,
      latestDateKey,
    });
    return;
  }

  const record = history[marker.dateKey];
  if (!record || record.photoUris.length === 0) {
    console.log('[SyncContext] thumbnail retry: no local record for marker date', { marker, latestDateKey });
    return;
  }

  const filesStillExist = record.photoUris.every((uri) => new File(uri).exists);
  if (!filesStillExist) {
    console.warn('[SyncContext] thumbnail retry: photo file(s) missing on disk, giving up', {
      marker,
      latestDateKey,
      photoUris: record.photoUris,
    });
    return;
  }

  try {
    await uploadThumbnails(userId, record.photoUris);
    await setThumbnailUploadMarker(userId, { dateKey: marker.dateKey, uploaded: true });
  } catch (error) {
    console.warn('[SyncContext] thumbnail retry failed; will try again next foreground', error);
  }
}

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

      if (cancelled) return;
      // Independent of whether the record reconciliation above succeeded
      // — thumbnails only need the local round's files and the network,
      // not a successful round_results round-trip.
      await retryThumbnailUploadIfNeeded(userId!, historyRef.current);
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
        if (!userId) return Promise.resolve();
        return uploadThumbnails(userId, photoUris).catch((error) => {
          console.warn('[SyncContext] pushThumbnails upload failed', error);
          throw error;
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
