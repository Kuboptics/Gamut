import { useNotificationTapDeepLink } from '../hooks/useNotificationTapDeepLink';
import { useRegisterPushToken } from '../hooks/useRegisterPushToken';

// Renders nothing — just bolts the push-notification hooks onto the app
// tree as their own component (see app/_layout.tsx), the same way
// IntroModal is its own sibling component there rather than logic
// inlined into RootLayout.
export function PushNotificationSetup(): null {
  useRegisterPushToken();
  useNotificationTapDeepLink();
  return null;
}
