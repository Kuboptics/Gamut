import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { REVEAL_STAGGER_MS, motionDuration, motionEasing } from '../constants/motion';
import { colors, fonts, spacing } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

const WORDMARK = 'GAMUT';
const SIGNATURE = 'By Kuboptics';

// Beats specific to this one-off launch sequence, not reused anywhere
// else in the app, so they live here rather than in constants/motion.ts.
const CURSOR_BLINK_MS = 250; // one blink phase; a full on/off cycle is ~2x this
const PAUSE_BEFORE_SECOND_LINE_MS = 200;
// "By Kuboptics" is 12 letters vs. GAMUT's 5 — at GAMUT's 140ms/letter
// pace it would take 1.54s on its own, so the second line types faster
// (half the delay) to keep the whole sequence around 2.5s total.
const SECOND_LINE_STAGGER_MS = REVEAL_STAGGER_MS / 2;
const HOLD_AFTER_TYPING_MS = 300;
const CURSOR_FADE_OUT_MS = 300;
const OVERLAY_FADE_MS = 400;

// Reduced-motion is much quicker: no typing, no cursor, just one fade.
const REDUCED_FADE_MS = motionDuration.base;
const REDUCED_HOLD_MS = 200;

type LaunchAnimationProps = {
  onDone: () => void;
};

// Plays once when the app starts, covering the whole screen (see
// app/_layout.tsx, which renders this on top of everything and only
// while it hasn't finished yet — nothing flashes behind it). Types out
// "GAMUT" letter by letter, pauses briefly, then the same cursor moves
// down and types out "By Kuboptics" underneath (same effect, its own
// small/muted style), holds, fades the cursor out, then fades the whole
// overlay out and calls onDone.
export function LaunchAnimation({ onDone }: LaunchAnimationProps) {
  const reducedMotion = useReducedMotion();

  // Normal mode: the "G" is already showing at mount (so the first
  // letter appears the instant the overlay mounts) and the rest reveals
  // on timers below. Reduced motion: both lines start fully typed.
  const [typedCountLine1, setTypedCountLine1] = useState(reducedMotion ? WORDMARK.length : 1);
  const [typedCountLine2, setTypedCountLine2] = useState(reducedMotion ? SIGNATURE.length : 0);
  const [showSubtitle, setShowSubtitle] = useState(reducedMotion);

  const overlayOpacity = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));

  useEffect(() => {
    // Every timer started below is collected here so all of them — both
    // typing intervals and every scheduled step after them — get cleared
    // on unmount. Nothing should keep running after onDone fires.
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let typingIntervalLine1: ReturnType<typeof setInterval> | undefined;
    let typingIntervalLine2: ReturnType<typeof setInterval> | undefined;

    function scheduleOverlayFade(delay: number) {
      timeouts.push(
        setTimeout(() => {
          overlayOpacity.value = withTiming(
            0,
            { duration: OVERLAY_FADE_MS, easing: motionEasing },
            (finished) => {
              if (finished) runOnJS(onDone)();
            }
          );
        }, delay)
      );
    }

    if (reducedMotion) {
      // Skip typing/cursor entirely: both lines are already showing (see
      // initial state above) and fade in together via the Animated.View's
      // `entering` below — just hold, then fade the whole thing out.
      scheduleOverlayFade(REDUCED_FADE_MS + REDUCED_HOLD_MS);
      return () => {
        timeouts.forEach(clearTimeout);
        cancelAnimation(overlayOpacity);
      };
    }

    // Blink the cursor continuously until it's explicitly stopped below.
    cursorOpacity.value = withRepeat(withTiming(0, { duration: CURSOR_BLINK_MS }), -1, true);

    typingIntervalLine1 = setInterval(() => {
      setTypedCountLine1((count) => {
        const next = count + 1;
        if (next >= WORDMARK.length && typingIntervalLine1) {
          clearInterval(typingIntervalLine1);
        }
        return next;
      });
    }, REVEAL_STAGGER_MS);

    // The "G" is already on screen at t=0 (initial state), and one more
    // letter lands every REVEAL_STAGGER_MS after that.
    const line1DoneAt = (WORDMARK.length - 1) * REVEAL_STAGGER_MS;

    // After a brief pause, start line two: the cursor implicitly "moves
    // down" simply because it stops rendering after line one (once
    // typedCountLine2 > 0, see render below) and starts rendering after
    // line two instead.
    timeouts.push(
      setTimeout(() => {
        setShowSubtitle(true);
        setTypedCountLine2(1);
        typingIntervalLine2 = setInterval(() => {
          setTypedCountLine2((count) => {
            const next = count + 1;
            if (next >= SIGNATURE.length && typingIntervalLine2) {
              clearInterval(typingIntervalLine2);
            }
            return next;
          });
        }, SECOND_LINE_STAGGER_MS);
      }, line1DoneAt + PAUSE_BEFORE_SECOND_LINE_MS)
    );

    const line2DoneAt =
      line1DoneAt + PAUSE_BEFORE_SECOND_LINE_MS + (SIGNATURE.length - 1) * SECOND_LINE_STAGGER_MS;

    // Hold with the cursor still blinking, then fade just the cursor out.
    timeouts.push(
      setTimeout(() => {
        cancelAnimation(cursorOpacity);
        cursorOpacity.value = withTiming(0, { duration: CURSOR_FADE_OUT_MS, easing: motionEasing });
      }, line2DoneAt + HOLD_AFTER_TYPING_MS)
    );

    scheduleOverlayFade(line2DoneAt + HOLD_AFTER_TYPING_MS + CURSOR_FADE_OUT_MS);

    return () => {
      if (typingIntervalLine1) clearInterval(typingIntervalLine1);
      if (typingIntervalLine2) clearInterval(typingIntervalLine2);
      timeouts.forEach(clearTimeout);
      cancelAnimation(cursorOpacity);
      cancelAnimation(overlayOpacity);
    };
  }, [reducedMotion]);

  const content = (
    <View style={styles.content}>
      <Text style={styles.wordmark}>
        {WORDMARK.slice(0, typedCountLine1)}
        {!reducedMotion && typedCountLine2 === 0 && (
          <Animated.Text style={[styles.cursorLine1, cursorStyle]}>|</Animated.Text>
        )}
      </Text>
      {showSubtitle && (
        <Text style={styles.signature}>
          {reducedMotion ? SIGNATURE : SIGNATURE.slice(0, typedCountLine2)}
          {!reducedMotion && typedCountLine2 > 0 && (
            <Animated.Text style={[styles.cursorLine2, cursorStyle]}>|</Animated.Text>
          )}
        </Text>
      )}
    </View>
  );

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      {reducedMotion ? (
        <Animated.View entering={FadeIn.duration(REDUCED_FADE_MS).easing(motionEasing)}>{content}</Animated.View>
      ) : (
        content
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  // No entry in constants/theme.ts's typeScale fits a full-screen hero
  // wordmark this large — this size is a one-off, local to the launch
  // sequence only.
  wordmark: {
    ...fonts.wordmark,
    fontSize: 56,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  cursorLine1: {
    ...fonts.wordmark,
    fontSize: 56,
    color: colors.textPrimary,
  },
  // Same small/muted style "By Kuboptics" always had — only its reveal
  // changed (typed, not faded), per the approved correction.
  signature: {
    ...fonts.primary,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  // Sized and colored to match the signature line it appears in, since
  // it's the same moving cursor, just rendered inline within that line.
  cursorLine2: {
    ...fonts.primary,
    fontSize: 14,
    color: colors.textMuted,
  },
});
