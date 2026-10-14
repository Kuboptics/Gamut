import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

type PlaceholderBarProps = {
  // How wide the bar is: a number of points or a percentage of its parent.
  width: DimensionValue;
  // Defaults to roughly one line of text.
  height?: number;
};

// A quiet grey block that stands in for text or a button while a list is
// still loading. secondarySurface (one step lighter than the panel it
// sits on, same as FriendThumbnails' photo placeholder) so it reads as
// "something goes here" without looking like real content. Fades in
// gently, or just appears when Reduce Motion is on. No spinner, no pulse.
export function PlaceholderBar({ width, height = spacing.lg }: PlaceholderBarProps) {
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(motionDuration.base).easing(motionEasing)}
      style={[styles.bar, { width, height }]}
    />
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.secondarySurface,
      borderRadius: radius.sm,
    },
  });
