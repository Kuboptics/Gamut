import { useCallback } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

// Tune the press feedback here.
const PRESS_SCALE = 0.97;
const PRESS_OPACITY = 0.7;
const PRESS_IN_DURATION_MS = 80;

// Shared by both the scale and opacity press-in animations. Explicitly
// named `reduceMotion` so it's clear in the code that this respects the
// OS "Reduce Motion" setting (ReduceMotion.System is Reanimated's
// default anyway, but spelling it out here documents the intent).
const PRESS_IN_CONFIG = { duration: PRESS_IN_DURATION_MS, reduceMotion: ReduceMotion.System } as const;

// The release "spring back". dampingRatio: 1 is critically damped — the
// fastest a spring can return to rest without overshooting past it — and
// overshootClamping is added as a second guarantee against any bounce.
// duration here is the spring's *perceptual* duration in ms, not a hard
// cutoff (Reanimated docs: actual settle time runs a bit longer).
const RELEASE_SPRING = {
  duration: 180,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const;

type PressableOpacityProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that scales down and dims slightly on touch, springing
// back (fast, no overshoot) on release. This is the one place every
// button/toggle/camera control in the app gets its pressed feedback
// from, so it's consistent everywhere instead of reimplemented per
// screen.
export function PressableOpacity({ style, onPressIn, onPressOut, ...props }: PressableOpacityProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      scale.value = withTiming(PRESS_SCALE, PRESS_IN_CONFIG);
      opacity.value = withTiming(PRESS_OPACITY, PRESS_IN_CONFIG);
      onPressIn?.(event);
    },
    [onPressIn, opacity, scale]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      scale.value = withSpring(1, RELEASE_SPRING);
      opacity.value = withTiming(1, PRESS_IN_CONFIG);
      onPressOut?.(event);
    },
    [onPressOut, opacity, scale]
  );

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
