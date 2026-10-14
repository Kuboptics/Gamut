import { useCallback, useEffect, useRef } from 'react';
import { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { useReducedMotion } from './useReducedMotion';

// Safety net: if a fade-in hasn't finished this long after it started (an
// interrupted animation, anything unexpected), the content is forced
// fully visible. A little more than double motionDuration.base, so a
// normal fade always finishes first.
const FADE_FAILSAFE_MS = 500;

// A reusable opacity fade-in, using the app's standard fade timing
// (motionDuration.base and motionEasing, same as CollapsibleCard,
// IntroModal and the other fades). Returns:
// - style: put it on an Animated.View around the content.
// - fadeIn(): fade from 0 (or from wherever it is now) to fully visible.
// - hide(): drop to invisible straight away (only ever used while the
//   content is off screen).
// - show(): jump straight to fully visible.
// - isHidden(): whether it's currently below fully visible.
//
// Content can never stay invisible: every fadeIn starts a fail-safe timer
// that forces it visible, and with Reduce Motion on, fadeIn just shows it
// straight away and hide does nothing.
export function useFadeIn(initiallyVisible = true) {
  const opacity = useSharedValue(initiallyVisible ? 1 : 0);
  const failSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read through a ref, so the functions below never change identity
  // (callers use them inside focus callbacks that must stay stable).
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const clearFailSafe = useCallback(() => {
    if (failSafeRef.current !== null) {
      clearTimeout(failSafeRef.current);
      failSafeRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearFailSafe();
    cancelAnimation(opacity);
    opacity.value = 1;
  }, [clearFailSafe, opacity]);

  const hide = useCallback(() => {
    if (reducedMotionRef.current) return; // Reduce Motion: always visible
    clearFailSafe();
    cancelAnimation(opacity);
    opacity.value = 0;
  }, [clearFailSafe, opacity]);

  const fadeIn = useCallback(
    ({ fromZero = false }: { fromZero?: boolean } = {}) => {
      if (reducedMotionRef.current) {
        show();
        return;
      }
      clearFailSafe();
      if (fromZero) opacity.value = 0;
      opacity.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing });
      failSafeRef.current = setTimeout(show, FADE_FAILSAFE_MS);
    },
    [clearFailSafe, opacity, show]
  );

  const isHidden = useCallback(() => opacity.value < 1, [opacity]);

  // On unmount: nothing left to show, but never leave a timer running.
  useEffect(() => clearFailSafe, [clearFailSafe]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return { style, fadeIn, hide, show, isHidden };
}
