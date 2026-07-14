import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

type FlameIconProps = {
  size: number;
};

// The Progress tab's icon — a small warm flame, the universal streak
// symbol. Unlike the other two tab icons it ignores the tab bar's
// active/inactive tint entirely and always renders in `colors.flame`,
// the same way the "live" dot elsewhere is always red regardless of
// state — a deliberate, narrow exception to the monochrome tab bar.
//
// Two shared values drive a slow scale + opacity pulse on slightly
// different durations, so the two loops drift in and out of phase —
// reads as a soft, organic candle flicker instead of a mechanical,
// perfectly-synced pulse. Both use withRepeat + a sine ease, never a
// spring, so there's no bounce.
export function FlameIcon({ size }: FlameIconProps) {
  const reducedMotion = useReducedMotion();
  const scaleFlicker = useSharedValue(0.5);
  const opacityFlicker = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) {
      // Hold both at their resting midpoint — a static, normal-looking
      // flame rather than freezing mid-dim or mid-bright.
      scaleFlicker.value = 0.5;
      opacityFlicker.value = 0.5;
      return;
    }

    scaleFlicker.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    opacityFlicker.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true);

    return () => {
      cancelAnimation(scaleFlicker);
      cancelAnimation(opacityFlicker);
    };
  }, [reducedMotion, scaleFlicker, opacityFlicker]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + scaleFlicker.value * 0.1 }],
    opacity: 0.82 + opacityFlicker.value * 0.18,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="flame" size={size} color={colors.flame} />
    </Animated.View>
  );
}
