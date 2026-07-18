// Local (on-device) daily reminder notifications, plus remote push
// token registration for the friend-nudge feature. The local reminder
// functions below are unaffected by Expo Go's SDK 53+ removal of
// *remote* push support — only getExpoPushTokenAsync (and receiving an
// actual push) requires a dev-client/EAS build.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground behavior: still show the banner/alert even while the app
// is open, so testing the reminder doesn't require backgrounding the
// app first.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Android requires a notification channel before anything can be
// scheduled on it. Harmless to call repeatedly — it just re-declares
// the same channel. iOS ignores this.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Daily reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Asks for notification permission, returning whether it's now granted.
// Safe to call even if permission was already granted or denied earlier
// — the OS only shows a real prompt the first time.
export async function requestNotificationPermissionAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Schedules the one daily reminder for the given time, replacing any
// previously scheduled reminder. The app only ever has this single
// notification, so cancel-then-reschedule is simpler and safer than
// tracking a notification id across app restarts.
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Gamut',
      body: "Today's color is waiting to be found.",
      // Lets a tap handler tell this apart from a remote friend-nudge
      // push, which carries a different `type` — see
      // hooks/useNotificationTapDeepLink.ts.
      data: { type: 'daily-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Fetches this device's Expo push token, for remote (friend-nudge)
// notifications — requires a dev-client/EAS build and a real device;
// returns null on a simulator, in Expo Go, or if anything else goes
// wrong, rather than throwing. Callers treat "no token" as a normal,
// silent no-op state (see lib/pushTokens.ts).
export async function getExpoPushTokenAsync(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
