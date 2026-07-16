import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

// The 4 bottom tabs, in the same order as their Tabs.Screen entries in
// app/(tabs)/_layout.tsx — index into this array is what each screen
// passes as `currentIndex`.
const TAB_ROUTES = ['/', '/progress', '/friends', '/settings'] as const;

// Distance (px) a horizontal drag must cover before it counts as a swipe
// rather than an incidental wobble.
const SWIPE_DISTANCE_THRESHOLD = 60;

function isHorizontalDrag(gesture: PanResponderGestureState): boolean {
  return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2;
}

// Lets a tab's root screen switch to the adjacent tab on a decisive
// horizontal swipe, the same way tapping the tab bar does. Deliberately
// built on the plain React Native PanResponder rather than adding
// react-native-gesture-handler — this only needs "claim a mostly-
// horizontal drag past a threshold, ignore everything else," which
// PanResponder already does without a new dependency or wrapping the
// app in a GestureHandlerRootView.
//
// Only ever call this from the 4 tab-root screens (Today, Progress,
// Friends, Settings) — never from a pushed screen on top of a tab
// (Manage Friends, day-detail, preview, capture, summary, photo-viewer).
// Those rely on iOS's native edge-swipe-back gesture, which this would
// otherwise fight; scoping this hook to just the tab roots means the two
// never overlap. onMoveShouldSetPanResponder only claims the gesture
// once a drag is clearly horizontal, so ordinary taps and each screen's
// own vertical ScrollView both keep working untouched.
export function useTabSwipe(currentIndex: number) {
  const router = useRouter();

  return useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
        isHorizontalDrag(gesture),
      onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (Math.abs(gesture.dx) < SWIPE_DISTANCE_THRESHOLD) return;

        // Swiping left (negative dx) moves forward a tab, right moves back
        // — the same direction convention as swiping between home screens.
        const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0 || nextIndex >= TAB_ROUTES.length) return;

        Haptics.selectionAsync().catch(() => {});
        router.navigate(TAB_ROUTES[nextIndex]);
      },
    })
  ).current.panHandlers;
}
