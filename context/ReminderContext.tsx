import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { cancelDailyReminder, requestNotificationPermissionAsync, scheduleDailyReminder } from '../lib/notifications';

// Where the reminder settings are saved on device, so they survive the
// app closing.
const STORAGE_KEY = 'colorhunt.reminder';

type StoredReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const DEFAULT_HOUR = 18;
const DEFAULT_MINUTE = 0;

type ReminderContextValue = {
  enabled: boolean;
  hour: number;
  minute: number;
  isLoaded: boolean;
  // True only right after the user tried to turn the reminder on and
  // the OS denied notification permission — lets the Settings screen
  // show a short explanation instead of just silently staying off.
  permissionDenied: boolean;
  // Turning it on requests permission first; if denied, `enabled` stays
  // false and `permissionDenied` becomes true. Turning it off always
  // succeeds and cancels the scheduled notification.
  setEnabled: (next: boolean) => void;
  setTime: (hour: number, minute: number) => void;
};

const ReminderContext = createContext<ReminderContextValue | null>(null);

// A local daily reminder: one on-device scheduled notification at a
// time the player picks. No accounts, no server — same "honest,
// local-only stepping stone" approach as StreakContext/HistoryContext.
export function ReminderProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [minute, setMinute] = useState(DEFAULT_MINUTE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const stored: StoredReminder = JSON.parse(raw);
          setEnabledState(stored.enabled);
          setHour(stored.hour);
          setMinute(stored.minute);
          // Re-assert the schedule on launch (harmless if it's already
          // scheduled) rather than assuming the OS never lost it.
          if (stored.enabled) {
            scheduleDailyReminder(stored.hour, stored.minute).catch(() => {
              // Non-fatal: worst case the reminder doesn't fire until
              // the player next changes a setting.
            });
          }
        }
      } catch {
        // Unreadable/corrupt storage just starts from the defaults, off.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const stored: StoredReminder = { enabled, hour, minute };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {
      // Non-fatal: the setting just won't survive an app restart this time.
    });
  }, [enabled, hour, minute, isLoaded]);

  const value = useMemo<ReminderContextValue>(
    () => ({
      enabled,
      hour,
      minute,
      isLoaded,
      permissionDenied,
      setEnabled: (next: boolean) => {
        if (!next) {
          setEnabledState(false);
          cancelDailyReminder().catch(() => {});
          return;
        }

        requestNotificationPermissionAsync().then((granted) => {
          if (granted) {
            setPermissionDenied(false);
            setEnabledState(true);
            scheduleDailyReminder(hour, minute).catch(() => {});
          } else {
            setPermissionDenied(true);
            setEnabledState(false);
          }
        });
      },
      setTime: (nextHour: number, nextMinute: number) => {
        setHour(nextHour);
        setMinute(nextMinute);
        if (enabled) {
          scheduleDailyReminder(nextHour, nextMinute).catch(() => {});
        }
      },
    }),
    [enabled, hour, minute, isLoaded, permissionDenied]
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminder(): ReminderContextValue {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminder must be used within a ReminderProvider');
  }
  return context;
}
