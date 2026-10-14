import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing, motionReduceMotion } from '../constants/motion';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PressableOpacity } from './PressableOpacity';

// The two segments, left to right: sun for light, moon for dark. `label`
// is what VoiceOver reads (the control has no visible text).
const OPTIONS: { value: ThemePreference; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { value: 'light', icon: 'sunny-outline', label: 'Light mode' },
  { value: 'dark', icon: 'moon-outline', label: 'Dark mode' },
];

// Sizes, in points.
// - TRACK_HEIGHT: the whole control's height; fully rounded.
// - SEGMENT_WIDTH: each of the two segments (also at least Apple's 44 pt
//   minimum tap width).
// - HIGHLIGHT_INSET: the gap between the sliding highlight and the track's
//   edge, like the iOS tab bar's selected capsule.
// - MIN_TAP_SIZE: hitSlop adds the missing height above and below so each
//   segment is tappable over at least 44 x 44 pt.
const TRACK_HEIGHT = 32;
const SEGMENT_WIDTH = 48;
const HIGHLIGHT_INSET = 2;
const ICON_SIZE = 18;
const MIN_TAP_SIZE = 44;
const TAP_SLOP_VERTICAL = (MIN_TAP_SIZE - TRACK_HEIGHT) / 2;

// The Light / Dark switch on Settings, styled like the iOS tab bar's
// selection: one rounded track with a sun and a moon, and one soft capsule
// behind the active icon that slides across when the choice changes.
// Picking an option calls setPreference, so the theme fade
// (components/ThemeSwitchFade.tsx) plays exactly as it does for any pick.
export function AppearanceToggle() {
  const { colors, scheme, preference, setPreference } = useTheme();
  const reducedMotion = useReducedMotion();

  // Track and highlight colors, all theme tokens. Like the iOS tab bar:
  // in dark mode a lighter capsule on a dark track, in light mode a white
  // capsule on a light grey track.
  const trackColor = scheme === 'dark' ? colors.surface : colors.secondarySurface;
  const highlightColor = scheme === 'dark' ? colors.secondarySurface : colors.surface;

  // Where the highlight sits: 0 under the first segment, SEGMENT_WIDTH
  // under the second. Starts at the current choice, so it never slides
  // when the screen opens.
  const selectedIndex = Math.max(0, OPTIONS.findIndex((option) => option.value === preference));
  const highlightX = useSharedValue(selectedIndex * SEGMENT_WIDTH);

  // Slides to the new choice whenever it changes; with Reduce Motion it
  // just jumps there.
  useEffect(() => {
    const target = selectedIndex * SEGMENT_WIDTH;
    highlightX.value = reducedMotion
      ? target
      : withTiming(target, { duration: motionDuration.base, easing: motionEasing, reduceMotion: motionReduceMotion });
  }, [selectedIndex, reducedMotion, highlightX]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, borderColor: colors.border }]}>
      {/* Drawn first, so the icons sit on top of it. */}
      <Animated.View style={[styles.highlight, { backgroundColor: highlightColor }, highlightStyle]} />
      {OPTIONS.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <PressableOpacity
            key={option.value}
            style={styles.segment}
            onPress={() => setPreference(option.value)}
            hitSlop={{ top: TAP_SLOP_VERTICAL, bottom: TAP_SLOP_VERTICAL }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
          >
            <Ionicons name={option.icon} size={ICON_SIZE} color={isSelected ? colors.textPrimary : colors.textMuted} />
          </PressableOpacity>
        );
      })}
    </View>
  );
}

// Layout only; the colors are set inline from the theme above.
const styles = StyleSheet.create({
  // A fixed height (not padding), so nothing can squeeze it. The hairline
  // outline keeps the track's shape visible on the day-tinted panels,
  // where its fill alone nearly matches the panel.
  track: {
    flexDirection: 'row',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Sits under the first segment, inset a little from the track's edge;
  // moved across by translateX.
  highlight: {
    position: 'absolute',
    top: HIGHLIGHT_INSET,
    bottom: HIGHLIGHT_INSET,
    left: HIGHLIGHT_INSET,
    width: SEGMENT_WIDTH - HIGHLIGHT_INSET * 2,
    borderRadius: (TRACK_HEIGHT - HIGHLIGHT_INSET * 2) / 2,
  },
  segment: {
    width: SEGMENT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
