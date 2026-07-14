import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// A round is 3 photos against today's color; the round passes if the
// average of the 3 scores is at least this percentage.
export const PHOTOS_PER_ROUND = 3;
export const PASS_THRESHOLD = 60;

// Where the in-progress round is saved on device, so it survives the
// app being fully closed (not just backgrounded).
const STORAGE_KEY = 'colorhunt.round';

// Camera/library photo URIs are temporary — banked photos get copied
// here (the permanent document directory, not the cache) so thumbnails
// still work after the app is fully closed and reopened.
const PHOTOS_DIRECTORY_NAME = 'round-photos';

// How often to check whether the calendar day has rolled over while the
// app stays open (so a round doesn't linger into a new day's color).
const DAY_CHECK_INTERVAL_MS = 30000;

type StoredRound = {
  dateKey: string;
  scores: number[];
  // Parallel to `scores` — same length, same index order.
  photoUris: string[];
};

type RoundContextValue = {
  scores: number[];
  // Parallel to `scores` — photoUris[i] is the photo that earned scores[i].
  photoUris: string[];
  // False until the persisted round has been read from storage, so
  // screens can avoid flashing "0 of 3" before a saved round loads.
  isLoaded: boolean;
  // Copies temporaryPhotoUri into permanent storage, records its score,
  // and returns the new banked count.
  bankPhoto: (score: number, temporaryPhotoUri: string) => number;
  // By default this deletes the round's banked photo files — correct
  // for an abandoned round (see the midnight-rollover effect below).
  // Pass `keepPhotos: true` when the round has already been recorded
  // to history (see app/summary.tsx) and its photos are now that
  // record's responsibility, not this context's, to clean up.
  resetRound: (options?: { keepPhotos?: boolean }) => void;
};

const RoundContext = createContext<RoundContextValue | null>(null);

// A YYYY-MM-DD key in local time — matches lib/dailyColor.ts's own date
// key, so "today" means the same thing in both places.
function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPhotosDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTOS_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create();
  }
  return directory;
}

// Copies a photo out of its temporary camera/library location into
// permanent app storage, returning the new permanent uri.
function copyToPermanentStorage(temporaryUri: string): string {
  const source = new File(temporaryUri);
  const destination = new File(getPhotosDirectory(), `${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  source.copy(destination);
  return destination.uri;
}

// Deletes banked photo files from permanent storage — called when a
// round resets, so old rounds' photos don't pile up on disk forever.
function deletePhotoFiles(uris: string[]): void {
  for (const uri of uris) {
    try {
      new File(uri).delete();
    } catch {
      // Already gone or inaccessible; nothing to clean up.
    }
  }
}

// Holds the running list of per-photo scores (and the photos
// themselves) for the current round, and persists them to AsyncStorage
// so a round can be spread across a whole day, closing and reopening
// the app between shots. Lives above the navigation stack (see
// app/_layout.tsx) so it also survives moving between the Capture and
// Preview screens.
export function RoundProvider({ children }: { children: ReactNode }) {
  const [scores, setScores] = useState<number[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [dateKey, setDateKey] = useState(todayKey);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load any in-progress round from device storage once, on launch.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const stored: StoredRound = JSON.parse(raw);
          // Only resume a round that belongs to today's color — a
          // round saved on a previous day starts fresh instead.
          if (stored.dateKey === todayKey()) {
            setScores(stored.scores);
            setPhotoUris(stored.photoUris ?? []);
          }
        }
      } catch {
        // Unreadable/corrupt storage just starts a fresh round.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist whenever scores/photos change, but only after the initial
  // load has happened — otherwise we'd briefly overwrite real saved
  // progress with an empty round before it's had a chance to load.
  useEffect(() => {
    if (!isLoaded) return;
    const stored: StoredRound = { dateKey, scores, photoUris };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {
      // Non-fatal: progress just won't survive an app restart this time.
    });
  }, [scores, photoUris, dateKey, isLoaded]);

  function resetRound(options?: { keepPhotos?: boolean }) {
    if (!options?.keepPhotos) {
      deletePhotoFiles(photoUris);
    }
    setScores([]);
    setPhotoUris([]);
  }

  // If the app is left open across local midnight, today's target color
  // changes underneath the round — check periodically and reset if so.
  useEffect(() => {
    const interval = setInterval(() => {
      const key = todayKey();
      if (key !== dateKey) {
        setDateKey(key);
        resetRound();
      }
    }, DAY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, photoUris]);

  const value = useMemo<RoundContextValue>(
    () => ({
      scores,
      photoUris,
      isLoaded,
      bankPhoto: (score: number, temporaryPhotoUri: string) => {
        const permanentUri = copyToPermanentStorage(temporaryPhotoUri);
        const nextScores = [...scores, score];
        setScores(nextScores);
        setPhotoUris([...photoUris, permanentUri]);
        return nextScores.length;
      },
      resetRound,
    }),
    [scores, photoUris, isLoaded]
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
