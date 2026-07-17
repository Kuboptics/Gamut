import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { scopedStorageKey } from '../lib/accountStorage';
import { useAuth } from './AuthContext';

// A round is 3 photos against today's color; the round passes if the
// average of the 3 scores is at least this percentage.
export const PHOTOS_PER_ROUND = 3;
export const PASS_THRESHOLD = 50;

// Where the in-progress round is saved on device, so it survives the
// app being fully closed (not just backgrounded). Suffixed per signed-in
// account (see lib/accountStorage.ts) so an in-progress round from one
// identity never bleeds into another sharing the same phone — otherwise
// finishing it would record (and upload) a mix of two accounts' photos
// under whoever happens to be signed in when the 3rd photo lands.
const BASE_STORAGE_KEY = 'colorhunt.round';

// Camera/library photo URIs are temporary — banked photos get copied
// here (the permanent document directory, not the cache) so thumbnails
// still work after the app is fully closed and reopened.
const PHOTOS_DIRECTORY_NAME = 'round-photos';

// How often to check whether the calendar day has rolled over while the
// app stays open (so a round doesn't linger into a new day's color).
const DAY_CHECK_INTERVAL_MS = 30000;

// One of the round's 3 slots — empty (null) until a photo is captured
// for it, just the photo's URI once it is. Deliberately holds no score:
// scoring only ever happens once, at Submit (see app/summary.tsx) — a
// slot is retaken freely up to that point by replacing just its own
// entry, never touching the other two.
export type RoundSlots = (string | null)[]; // always length PHOTOS_PER_ROUND

function emptySlots(): RoundSlots {
  return Array(PHOTOS_PER_ROUND).fill(null);
}

type StoredRound = {
  dateKey: string;
  slots: RoundSlots;
};

type RoundContextValue = {
  slots: RoundSlots;
  // False until the persisted round has been read from storage, so
  // screens can avoid flashing "0 of 3" before a saved round loads.
  isLoaded: boolean;
  // Copies temporaryPhotoUri into permanent storage and records it as
  // the given slot's photo, replacing whatever (if anything) that slot
  // held before — the other slots are untouched.
  setSlot: (index: number, temporaryPhotoUri: string) => void;
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

// Holds the round's 3 photo slots (unscored — see app/summary.tsx for
// where scoring actually happens, only once, at Submit) and persists
// them to AsyncStorage so a round can be spread across a whole day,
// closing and reopening the app between shots. Lives above the
// navigation stack (see app/_layout.tsx) so it also survives moving
// between the Capture and Preview screens.
export function RoundProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: isAuthLoaded } = useAuth();
  const storageKey = scopedStorageKey(BASE_STORAGE_KEY, user?.id ?? null);

  const [slots, setSlots] = useState<RoundSlots>(emptySlots);
  const [dateKey, setDateKey] = useState(todayKey);
  const [isLoaded, setIsLoaded] = useState(false);

  // Loads any in-progress round from device storage, re-running whenever
  // the signed-in identity changes (see HistoryContext for the same
  // pattern) so switching accounts always starts from a clean slate
  // rather than resuming whatever the previous identity was mid-round on.
  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    setIsLoaded(false);
    setSlots(emptySlots());

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!cancelled && raw) {
          const stored: StoredRound = JSON.parse(raw);
          // Only resume a round that belongs to today's color — a
          // round saved on a previous day starts fresh instead. Also
          // guards against an older, pre-slots StoredRound shape still
          // sitting in storage from before this model existed.
          if (stored.dateKey === todayKey() && Array.isArray(stored.slots)) {
            setSlots(stored.slots);
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
  }, [storageKey, isAuthLoaded]);

  // Persist whenever the slots change, but only after the initial load
  // has happened — otherwise we'd briefly overwrite real saved progress
  // with an empty round before it's had a chance to load.
  useEffect(() => {
    if (!isLoaded) return;
    const stored: StoredRound = { dateKey, slots };
    AsyncStorage.setItem(storageKey, JSON.stringify(stored)).catch(() => {
      // Non-fatal: progress just won't survive an app restart this time.
    });
  }, [slots, dateKey, isLoaded, storageKey]);

  function resetRound(options?: { keepPhotos?: boolean }) {
    if (!options?.keepPhotos) {
      const uris = slots.filter((uri): uri is string => uri !== null);
      deletePhotoFiles(uris);
    }
    setSlots(emptySlots());
  }

  // If the app is left open across local midnight, today's target color
  // changes underneath the round — check periodically and reset if so.
  // Always keeps the photo files: if the round was already submitted (see
  // app/summary.tsx), `slots` still holds the same photo URIs the history
  // record for that day now permanently points to — deleting them here
  // would silently break that day's Calendar/day-detail thumbnails even
  // though the record itself looks fine. An abandoned, never-submitted
  // round's photos leak a few small files on disk instead, which is a far
  // smaller cost than corrupting saved history.
  useEffect(() => {
    const interval = setInterval(() => {
      const key = todayKey();
      if (key !== dateKey) {
        setDateKey(key);
        resetRound({ keepPhotos: true });
      }
    }, DAY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, slots]);

  const value = useMemo<RoundContextValue>(
    () => ({
      slots,
      isLoaded,
      setSlot: (index: number, temporaryPhotoUri: string) => {
        // A bad index (e.g. NaN from a dropped route param) must never
        // silently no-op — nextSlots[NaN] = uri would leave every real
        // slot untouched with no sign anything went wrong. Throw instead
        // so the caller (see app/preview.tsx) can surface it.
        if (!Number.isInteger(index) || index < 0 || index >= PHOTOS_PER_ROUND) {
          throw new Error(`setSlot: received an invalid slot index (${index})`);
        }

        // If the copy throws, the slot must not be marked filled — bail
        // out before touching state at all.
        let permanentUri: string;
        try {
          permanentUri = copyToPermanentStorage(temporaryPhotoUri);
        } catch (error) {
          throw new Error(
            `setSlot: could not save the photo (${error instanceof Error ? error.message : String(error)})`
          );
        }

        // Functional updater, not a closure over the outer `slots` — so
        // two setSlot calls firing before a re-render can't clobber each
        // other off a stale snapshot.
        setSlots((prev) => {
          const previous = prev[index];
          const nextSlots = prev.slice();
          nextSlots[index] = permanentUri;
          // Only after the new photo is safely copied and slotted in —
          // never leaves a slot pointing at a deleted file.
          if (previous) deletePhotoFiles([previous]);
          return nextSlots;
        });
      },
      resetRound,
    }),
    [slots, isLoaded]
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
