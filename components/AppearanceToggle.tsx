import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motionReduceMotion, THEME_SWITCH_DELAY_MS, toggleSpringConfig } from '../constants/motion';
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

// Safety net: if the highlight hasn't settled on its target this long
// after a tap (an interrupted spring, anything unexpected), it's snapped
// straight there, so it can never stay in the wrong place.
const SETTLE_FAILSAFE_MS = 600;

// Which segment (0 or 1) a choice belongs to.
function indexFor(value: ThemePreference): number {
  return Math.max(0, OPTIONS.findIndex((option) => option.value === value));
}

// The Light / Dark switch on Settings, styled like the iOS tab bar's
// selection: one rounded track with a sun and a moon, and one soft capsule
// behind the active icon that springs across when the choice changes.
// Picking an option calls setPreference, so the theme fade
// (components/ThemeSwitchFade.tsx) plays exactly as it does for any pick.
//
// Why it keeps its own copy of the choice (`shownIndex`): switching the
// theme re-renders the whole app, which takes a moment, and applying it
// briefly blocks animations. So a tap moves the highlight and swaps the
// icon colors right away, here, and only hands the choice to the theme
// once the slide has finished (THEME_SWITCH_DELAY_MS), so the switch
// never stalls the slide halfway.
export function AppearanceToggle() {
  const { colors, scheme, preference, setPreference } = useTheme();
  const reducedMotion = useReducedMotion();

  // Track and highlight colors, all theme tokens. Like the iOS tab bar:
  // in dark mode a lighter capsule on a dark track, in light mode a white
  // capsule on a light grey track.
  const trackColor = scheme === 'dark' ? colors.surface : colors.secondarySurface;
  const highlightColor = scheme === 'dark' ? colors.secondarySurface : colors.surface;

  // The segment shown as selected, and where the highlight sits (0 under
  // the first segment, SEGMENT_WIDTH under the second). Both start at the
  // saved choice, so nothing moves when the screen opens.
  const [shownIndex, setShownIndex] = useState(() => indexFor(preference));
  const highlightX = useSharedValue(indexFor(preference) * SEGMENT_WIDTH);

  // The choice from the latest tap that the theme hasn't caught up with
  // yet (null once it has).
  const pendingRef = useRef<ThemePreference | null>(null);
  // The latest saved choice, readable from the next-frame callback below.
  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;
  const failSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearFailSafe() {
    if (failSafeRef.current !== null) {
      clearTimeout(failSafeRef.current);
      failSafeRef.current = null;
    }
  }

  // Straight to a segment, no animation.
  function snapTo(index: number) {
    clearFailSafe();
    cancelAnimation(highlightX);
    highlightX.value = index * SEGMENT_WIDTH;
  }

  // Spring to a segment (or jump, with Reduce Motion). A new tap simply
  // starts a new spring toward the newest target from wherever the
  // highlight is, so quick repeated taps always end on the last one; the
  // fail-safe makes sure of it.
  function moveTo(index: number) {
    if (reducedMotion) {
      snapTo(index);
      return;
    }
    clearFailSafe();
    const target = index * SEGMENT_WIDTH;
    highlightX.value = withSpring(target, { ...toggleSpringConfig, reduceMotion: motionReduceMotion });
    failSafeRef.current = setTimeout(() => {
      failSafeRef.current = null;
      if (Math.abs(highlightX.value - target) > 0.5) {
        cancelAnimation(highlightX);
        highlightX.value = target;
      }
    }, SETTLE_FAILSAFE_MS);
  }

  function handlePress(value: ThemePreference) {
    const index = indexFor(value);
    // Right away: the highlight starts moving and the icon colors swap
    // (this re-renders only this small control).
    setShownIndex(index);
    moveTo(index);
    // Once the slide has settled: tell the theme. Only the latest tap's
    // choice is sent (each tap restarts the wait). Not cancelled if the
    // screen goes away meanwhile, so a tap is never lost.
    pendingRef.current = value;
    if (switchTimerRef.current !== null) clearTimeout(switchTimerRef.current);
    const sendToTheme = () => {
      switchTimerRef.current = null;
      if (preferenceRef.current === value) {
        // Already the saved choice (e.g. tapped back to it): nothing to send.
        pendingRef.current = null;
      } else {
        setPreference(value);
      }
    };
    if (reducedMotion) {
      // No slide to wait for: switch straight away, as before.
      sendToTheme();
    } else {
      switchTimerRef.current = setTimeout(sendToTheme, THEME_SWITCH_DELAY_MS);
    }
  }

  // Keeps the control in step with the saved choice.
  // - When the theme catches up with our own latest tap: nothing to do.
  // - While an older tap is still landing on the way to a newer one:
  //   ignore it, the newer one follows.
  // - Any other change (the saved choice loading, or a change made
  //   anywhere else): follow it straight away, with no animation.
  useEffect(() => {
    const pending = pendingRef.current;
    if (pending !== null) {
      if (preference === pending) pendingRef.current = null;
      return;
    }
    const index = indexFor(preference);
    setShownIndex(index);
    snapTo(index);
    // snapTo only uses refs and the shared value, so it doesn't need to be
    // a dependency; this must run only when the saved choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference]);

  // Never leave the fail-safe timer running after the screen goes away.
  useEffect(() => clearFailSafe, []);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, borderColor: colors.border }]}>
      {/* Drawn first, so the icons sit on top of it. */}
      <Animated.View style={[styles.highlight, { backgroundColor: highlightColor }, highlightStyle]} />
      {OPTIONS.map((option, index) => {
        const isSelected = index === shownIndex;
        return (
          <PressableOpacity
            key={option.value}
            style={styles.segment}
            onPress={() => handlePress(option.value)}
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
