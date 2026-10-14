import { useEffect } from 'react';
import { StyleSheet, Text, type DimensionValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  makeMutable,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motionDuration, motionEasing, PLACEHOLDER_DELAY_MS, pulseEasing, pulseLow } from '../constants/motion';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

// ---------------------------------------------------------------------
// The one shared pulse.
//
// Every skeleton box in the app reads its pulse from this single value,
// so all boxes on screen fade down and up together instead of each
// running its own out-of-step animation. makeMutable creates a Reanimated
// shared value outside any component, so there is exactly one of it.
//
// It only runs while at least one box is on screen: `pulsingBarCount`
// counts the boxes that are currently mounted. The first box to mount
// starts the pulse; the last box to unmount stops it and resets it to
// full opacity, ready for the next time.
// ---------------------------------------------------------------------
const sharedPulse = makeMutable(1);
let pulsingBarCount = 0;

function addPulsingBar() {
  pulsingBarCount += 1;
  // Only the first box starts the animation. Later boxes just join the
  // one that's already running, which is what keeps them in sync.
  if (pulsingBarCount === 1) {
    // ReduceMotion.Never because Reduce Motion is handled by the boxes
    // themselves (a box with Reduce Motion on never joins the pulse — see
    // PlaceholderBar below), so this animation only ever runs when it's
    // wanted.
    sharedPulse.value = withRepeat(
      withTiming(pulseLow, { duration: motionDuration.pulse, easing: pulseEasing, reduceMotion: ReduceMotion.Never }),
      -1, // repeat forever, until stopPulse cancels it
      true, // reverse each time: down to pulseLow, back up to 1, and so on
      undefined,
      ReduceMotion.Never
    );
  }
}

function removePulsingBar() {
  // Math.max guards against the count ever going below zero, so a stray
  // extra call can't leave the counter in a state where the next box
  // wouldn't restart the pulse.
  pulsingBarCount = Math.max(0, pulsingBarCount - 1);
  if (pulsingBarCount === 0) {
    cancelAnimation(sharedPulse);
    sharedPulse.value = 1;
  }
}

type PlaceholderBarProps = {
  // A number of points or a percentage of the parent. Leave it out to size
  // the box from `sampleText` (when textStyle is given) or from `style`.
  width?: DimensionValue;
  // Used only without textStyle. Defaults to roughly one line of text.
  height?: number;
  // Makes the box exactly one line of text tall in this style, so it takes
  // the same space as the real text it stands in for (and grows with the
  // iPhone's text-size setting the same way). Any margins in the style are
  // moved to the outside of the box, where they'd sit on the real text.
  textStyle?: StyleProp<TextStyle>;
  // The invisible text that sizes the box. A single space by default (only
  // the height matters); pass a real word, like a button label, when the
  // box should also be as wide as that word.
  sampleText?: string;
  // Shape overrides, e.g. a button's padding and radius, or a thumbnail's
  // size and border, so the box matches the real element exactly.
  style?: StyleProp<ViewStyle>;
};

// A quiet grey box that stands in for content while a screen loads.
// - Waits PLACEHOLDER_DELAY_MS before showing, so fast loads never flash
//   grey. It still takes up its space while it waits, so nothing moves.
// - Then fades in and joins the shared pulse above.
// - With Reduce Motion on: appears after the same delay at full opacity,
//   with no fade and no pulse.
export function PlaceholderBar({ width, height = spacing.lg, textStyle, sampleText = ' ', style }: PlaceholderBarProps) {
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();

  // This box's own visibility, 0 to 1 — separate from the shared pulse, so
  // each box can wait out its own delay. The two are multiplied below.
  const visibility = useSharedValue(0);

  useEffect(() => {
    // ReduceMotion.Never so the delay itself still applies with Reduce
    // Motion on (it's about avoiding a flash, not about motion). The fade
    // is skipped in that case by using a duration of 0.
    visibility.value = withDelay(
      PLACEHOLDER_DELAY_MS,
      withTiming(1, {
        duration: reducedMotion ? 0 : motionDuration.base,
        easing: motionEasing,
        reduceMotion: ReduceMotion.Never,
      }),
      ReduceMotion.Never
    );
    return () => cancelAnimation(visibility);
  }, [visibility, reducedMotion]);

  // Join the shared pulse while mounted, leave it on unmount. Every add
  // has exactly one matching remove (this effect's cleanup), which is
  // what keeps pulsingBarCount accurate.
  useEffect(() => {
    if (reducedMotion) return;
    addPulsingBar();
    return removePulsingBar;
  }, [reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visibility.value * (reducedMotion ? 1 : sharedPulse.value),
  }));

  // Split the text style: margins go on the box (outside), everything else
  // goes on the invisible text (inside) that gives the box its height.
  const {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    ...textOnlyStyle
  } = StyleSheet.flatten(textStyle) ?? {};
  const textMargins = { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical };

  return (
    <Animated.View
      // Nothing to read yet, so VoiceOver skips the box entirely.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.bar,
        width !== undefined && { width },
        !textStyle && { height },
        textStyle && textMargins,
        style,
        animatedStyle,
      ]}
    >
      {textStyle && (
        <Text style={[textOnlyStyle, styles.hiddenText]} numberOfLines={1}>
          {sampleText}
        </Text>
      )}
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.placeholder,
      // Same as the fill, so a box that borrows a border width from the
      // real element (e.g. a button's hairline) doesn't get a black edge.
      borderColor: colors.placeholder,
      borderRadius: radius.sm,
    },
    // Takes up space, never visible.
    hiddenText: {
      opacity: 0,
    },
  });
