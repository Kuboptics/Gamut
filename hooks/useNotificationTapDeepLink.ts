import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// Sends the player to Today (app/(tabs)/index.tsx, route "/") when they
// tap a friend-nudge push — it's already the deep-link target as-is,
// since it branches itself between the completed and in-progress states,
// so no separate "submission screen" route is needed.
//
// Covers both ways a tap can be observed: cold-start, where the app was
// closed and the tap is what launched it (getLastNotificationResponseAsync
// is the only way to see that after the fact), and warm, where the app was
// already running or backgrounded (addNotificationResponseReceivedListener
// fires live). The `type` check lets this ignore taps on the unrelated
// local daily-reminder notification (see lib/notifications.ts), which
// isn't meant to deep-link anywhere beyond just opening the app.
export function useNotificationTapDeepLink(): void {
  const router = useRouter();

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data?.type === 'friend-submitted') {
        router.push('/');
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type === 'friend-submitted') {
        router.push('/');
      }
    });

    return () => subscription.remove();
  }, [router]);
}
