// Whether the first-run intro modal has ever been dismissed. This is a
// device/install-level fact, not tied to any signed-in account — a
// brand-new device should see it once regardless of which account (or
// no account at all) ends up signed in, so it deliberately isn't run
// through lib/accountStorage.ts's per-account scoping.

import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_SEEN_KEY = 'colorhunt.introSeen';

export async function hasSeenIntro(): Promise<boolean> {
  const value = await AsyncStorage.getItem(INTRO_SEEN_KEY);
  return value === 'true';
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
}
