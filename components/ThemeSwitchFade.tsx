import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing, motionReduceMotion } from '../constants/motion';
import { useTheme } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

// The soft dissolve when the player switches between light and dark mode
// in Settings. The whole app switches to its new colors at once; on top
// of it, a full-screen cover in the OLD background color starts fully
// visible and fades away, so the change reads as a dissolve instead of a
// hard cut.
//
// - Only for switches the player made (see themeSwitch in
//   context/ThemeContext.tsx) — never at launch.
// - Reduce Motion on: nothing is drawn, so the switch is instant.
// - Never blocks touches (pointerEvents: 'none'), so the app is usable
//   during the fade.
//
// Rendered once, above everything else, in app/_layout.tsx.
export function ThemeSwitchFade() {
  const { themeSwitch } = useTheme();
  const reducedMotion = useReducedMotion();
  if (!themeSwitch || reducedMotion) return null;
  // `key` gives each switch a brand-new cover, so it always starts fully
  // visible — even if the player switches again mid-fade.
  return <FadingCover key={themeSwitch.id} color={themeSwitch.fromBackground} />;
}

function FadingCover({ color }: { color: string }) {
  // Starts at 1 on the very first frame, so the new colors underneath
  // are never shown uncovered before the fade begins.
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(0, {
      duration: motionDuration.themeFade,
      easing: motionEasing,
      reduceMotion: motionReduceMotion,
    });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Once faded out it just stays mounted at opacity 0 (invisible, and it
  // ignores touches) until the next switch replaces it.
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cover, { backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});
