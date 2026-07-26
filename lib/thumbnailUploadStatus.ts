// Local-only record of whether the MOST RECENT round's thumbnail upload
// actually reached Supabase Storage. Thumbnails don't self-heal the way
// round_results does — see context/SyncContext.tsx, which reconciles
// round_results against the cloud on every foreground but has nothing
// equivalent for thumbnails, since a synced round_results row never
// carries photos (lib/historySync.ts's fromCloudRow hard-codes
// photoUris: []). This marker is what lets SyncContext retry a
// silently-failed thumbnail upload the same way, without adding
// anything to the synced record schema.
//
// Only ever holds one round. lib/thumbnails.ts uploads to a fixed
// `${userId}/${slot}.jpg` path that always holds just the latest
// round's photos — retrying an old day's upload would overwrite
// today's correct thumbnails with stale ones, so callers must check
// the marker's dateKey is still the latest local round before using it
// (see SyncContext's retry logic).

import AsyncStorage from '@react-native-async-storage/async-storage';

import { scopedStorageKey } from './accountStorage';

const BASE_STORAGE_KEY = 'colorhunt.thumbnailUpload';

export type ThumbnailUploadMarker = {
  dateKey: string;
  uploaded: boolean;
};

export async function getThumbnailUploadMarker(userId: string | null): Promise<ThumbnailUploadMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(scopedStorageKey(BASE_STORAGE_KEY, userId));
    if (!raw) return null;
    return JSON.parse(raw) as ThumbnailUploadMarker;
  } catch {
    // Unreadable/corrupt storage — treat as "no marker", same as HistoryContext
    // and RoundContext do for their own stored state.
    return null;
  }
}

export async function setThumbnailUploadMarker(userId: string | null, marker: ThumbnailUploadMarker): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedStorageKey(BASE_STORAGE_KEY, userId), JSON.stringify(marker));
  } catch (error) {
    console.warn('[thumbnailUploadStatus] failed to persist upload marker', marker, error);
  }
}
