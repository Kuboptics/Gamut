// Talks to the `thumbnails` Storage bucket in Supabase (see the SQL in
// the Stage 4/5 setup notes for the bucket + policies). Pure network/
// image-prep functions — no React here; context/SyncContext.tsx decides
// when to call these, and lib/leaderboard.ts decides when to read them
// back.
//
// Unlike round_results (one row per day, keyed by date), a thumbnail's
// path never includes the date — it's just `${userId}/${slot}.jpg` for
// slot 0, 1, 2. Uploading today's shots overwrites yesterday's file at
// that same path, so storage never accumulates and nothing needs an
// explicit delete step: the bucket always holds at most 3 tiny files per
// user. The leaderboard only ever asks for a friend's thumbnails when
// their `round_results` row for *today* exists, so stale bytes sitting
// at that path from a day they didn't play are simply never requested.

import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from './supabase';

const BUCKET = 'thumbnails';

// Sized to stay sharp at the leaderboard's display size (56pt squares,
// see components/FriendThumbnails.tsx) even on a 3x-density phone screen
// (56 * 3 = 168px needed; 240px leaves comfortable headroom), while
// staying heavily compressed — only 3 of these ever exist per user
// (overwritten each round), so a modest size increase is still tiny.
const THUMBNAIL_WIDTH = 240;
const THUMBNAIL_QUALITY = 0.35;

export function thumbnailPath(userId: string, slot: number): string {
  return `${userId}/${slot}.jpg`;
}

// Shrinks and compresses one photo down to a small JPEG file, the same
// expo-image-manipulator call app/preview.tsx already uses for sampling,
// just smaller/lower-quality and saved to a file (rather than base64)
// since this copy needs to be uploaded as bytes.
async function prepareThumbnail(photoUri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: THUMBNAIL_WIDTH } }],
    { compress: THUMBNAIL_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipulated.uri;
}

// Resizes and uploads every photo in a round to this user's 3 stable
// slots, overwriting whatever was there before. Fire-and-forget from the
// caller's side (see SyncContext.pushThumbnails) — a failure here just
// means friends don't see squares for today, nothing else in the app
// depends on it.
//
// Reads each file as an arrayBuffer, not a Blob. In React Native, a Blob
// from fetch(uri).blob() doesn't carry real bytes through supabase-js's
// upload() the way it does in a browser — the object gets created at the
// right path (so it looks successful, and even signs/reads fine) but its
// contents come out empty/corrupt. arrayBuffer() reads the actual bytes
// directly, which is what Supabase's own React Native docs use for this
// exact reason.
export async function uploadThumbnails(userId: string, photoUris: string[]): Promise<void> {
  await Promise.all(
    photoUris.map(async (photoUri, slot) => {
      const path = thumbnailPath(userId, slot);
      const thumbnailUri = await prepareThumbnail(photoUri);
      const arrayBuffer = await (await fetch(thumbnailUri)).arrayBuffer();
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    })
  );
}

// Batch-mints short-lived signed URLs for a set of thumbnail paths in
// one request — used by the leaderboard to show everyone's squares
// without a round-trip per file. Returns only the paths that resolved;
// a friend who hasn't uploaded a thumbnail for a path (or any other
// per-file failure) is just missing from the map, not an error for the
// whole batch.
export async function fetchThumbnailUrls(paths: string[]): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>();
  if (paths.length === 0) return urlByPath;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) return urlByPath;

  for (const result of data ?? []) {
    if (result.signedUrl && !result.error) {
      urlByPath.set(result.path ?? '', result.signedUrl);
    }
  }
  return urlByPath;
}
