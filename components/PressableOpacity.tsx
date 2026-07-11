import { useCallback } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing, motionReduceMotion, releaseSpringConfig } from '../constants/motion';

// Tune the press feedback here.
const PRESS_SCALE = 0.97;
const PRESS_OPACITY = 0.7;

// Shared by both the scale and opacity press-in animations. Draws from
// the app's one shared set of motion values (constants/motion.ts)
// rather than defining its own duration/easing/reduceMotion.
const PRESS_IN_CONFIG = {
  duration: motionDuration.press,
  easing: motionEasing,
  reduceMotion: motionReduceMotion,
} as const;

const PRESS_OUT_OPACITY_CONFIG = {
  duration: motionDuration.base,
  easing: motionEasing,
  reduceMotion: motionReduceMotion,
} as const;

type PressableOpacityProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that scales down and dims slightly on touch, springing
// back (fast, no overshoot) on release. This is the one place every
// button/toggle/control in the app gets its pressed feedback from, so
// it's consistent everywhere instead of reimplemented per screen.
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
      scale.value = withSpring(1, releaseSpringConfig);
      opacity.value = withTiming(1, PRESS_OUT_OPACITY_CONFIG);
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
