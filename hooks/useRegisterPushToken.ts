import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { getExpoPushTokenAsync } from '../lib/notifications';
import { savePushToken } from '../lib/pushTokens';

// Keeps this device's Expo push token up to date in Supabase, but never
// asks for permission itself — that stays owned by the notifications
// toggle in Settings (app/(tabs)/settings.tsx), the one place this app
// asks for notification permission, and only when the player opts in.
// So this only re-registers a token when permission is *already*
// granted (e.g. it was granted in a previous session, or the OS token
// rotated) — on a fresh install with permission never granted, this is
// a silent no-op, same as every other function here that treats "no
// token" as normal rather than an error.
export function useRegisterPushToken(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    Notifications.getPermissionsAsync().then(({ granted }) => {
      if (!granted) return;
      getExpoPushTokenAsync().then((token) => {
        if (token) savePushToken(user.id, token).catch(() => {});
      });
    });
  }, [user]);
}
