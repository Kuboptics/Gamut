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
import { Image } from 'react-native';

import { supabase } from './supabase';

const BUCKET = 'thumbnails';

// This one file gets used two ways: a small 56pt square on the
// leaderboard row (see components/FriendThumbnails.tsx) and a
// full-screen resizeMode="contain" viewer (see components/
// PhotoViewerModal.tsx) — the viewer is what sets the real size floor
// here, not the leaderboard square. 1080 on the long edge is comfortably
// sharp full-screen on any current phone while staying a modest file
// size at 0.85 JPEG quality; still only 3 of these per user, overwritten
// each round, so the larger size doesn't accumulate.
const THUMBNAIL_LONG_EDGE = 1080;
const THUMBNAIL_QUALITY = 0.85;

export function thumbnailPath(userId: string, slot: number): string {
  return `${userId}/${slot}.jpg`;
}

// react-native's own Image.getSize, promisified — no new dependency.
// Needed because expo-image-manipulator's resize only clamps whichever
// dimension you give it (e.g. `{ width: 1080 }` on a portrait photo
// would leave its taller height uncapped) — measuring first lets
// prepareThumbnail below clamp whichever dimension is actually longest.
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// Shrinks and compresses one photo down to a JPEG file, the same
// expo-image-manipulator call app/preview.tsx already uses for sampling,
// just resized/compressed differently and saved to a file (rather than
// base64) since this copy needs to be uploaded as bytes.
async function prepareThumbnail(photoUri: string): Promise<string> {
  const { width, height } = await getImageSize(photoUri);
  const resize = width >= height ? { width: THUMBNAIL_LONG_EDGE } : { height: THUMBNAIL_LONG_EDGE };

  const manipulated = await ImageManipulator.manipulateAsync(photoUri, [{ resize }], {
    compress: THUMBNAIL_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
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
      if (error) {
        console.warn('[thumbnails] upload failed for', path, error);
        throw error;
      }
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
