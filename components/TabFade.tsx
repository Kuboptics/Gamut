import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { useFadeIn } from '../hooks/useFadeIn';

// Wraps everything below AppHeader on a tab screen, so that part fades in
// (opacity only, nothing moves) when the tab is opened from another tab,
// by tapping the tab bar or swiping. The header sits outside it and never
// fades.
//
// When it fades, and when it doesn't:
// - Coming from another tab: fades in. The content was already made
//   invisible when this tab lost focus to the other tab (while off
//   screen), so the very first visible frame is already at 0.
// - Returning from a pushed screen (Day detail, Friend profile, Manage
//   friends): no fade. Those open on top of the tabs, so this tab never
//   lost focus to another tab, and its content stayed fully visible.
// - At launch: no fade for the tab that's shown first. The other tabs
//   start invisible (they're off screen), so the first visit to each one
//   fades in like any other tab switch.
// - Reduce Motion on: never fades, always fully visible.
//
// Opacity doesn't change layout, so nothing inside measures any
// differently (including Today's color card, which sizes itself with
// onLayout). See hooks/useFadeIn.ts for the timing and the fail-safe.
export function TabFade({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const route = useRoute();

  // Decided once, when this tab is first created: visible if it's the
  // tab on screen at that moment (the launch tab), invisible otherwise.
  const [startsVisible] = useState(() => navigation.isFocused());
  const { style, fadeIn, hide, show, isHidden } = useFadeIn(startsVisible);

  // Runs only on focus and blur events (the callback never changes), so
  // re-renders like the countdown ticking, data loading or a theme
  // change can never replay the fade.
  useFocusEffect(
    useCallback(() => {
      // Focus: fade in only if the content was hidden while away.
      if (isHidden()) fadeIn();

      // Blur (and unmount): hide only if another TAB is now on screen.
      return () => {
        let focusedTabKey: string | undefined;
        try {
          const state = navigation.getState();
          focusedTabKey = state?.routes[state.index]?.key;
        } catch {
          focusedTabKey = undefined;
        }
        if (focusedTabKey !== undefined && focusedTabKey !== route.key) {
          hide();
        } else {
          // A pushed screen, an unmount, or anything unexpected: stay
          // fully visible.
          show();
        }
      };
    }, [navigation, route.key, fadeIn, hide, show, isHidden])
  );

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  // Takes all the space below the header, exactly like the content it
  // wraps did before, so the layout at rest is unchanged.
  fill: {
    flex: 1,
  },
});
