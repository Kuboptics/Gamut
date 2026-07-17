import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motionEasing } from '../constants/motion';
import { colors } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

const PARTICLE_COUNT = 14;
// Deliberately their own values, not motionDuration.base — a radial
// burst and a shake need a longer/shorter feel than the app's standard
// 220ms fade, the same reasoning FlameIcon's ambient flicker durations
// already use. Both still share the app's one easing curve (motionEasing)
// below, so they read as the same instrument, just tuned for their own
// motion.
const BURST_DURATION_MS = 650;
const SHAKE_STEP_MS = 90;

// Kept in the monochrome + green palette, with one or two red particles
// mixed in — small squares, not confetti shapes, so it stays "precise
// instrument" rather than "party".
const PARTICLE_COLORS = [
  colors.textPrimary,
  colors.positive,
  colors.positive,
  colors.textPrimary,
  colors.positive,
  colors.textMuted,
  colors.signal,
];

type ResultCelebrationProps = {
  passed: boolean;
  // Fires the burst/shake the moment this becomes true, rather than on
  // mount — the verdict this wraps stays mounted (invisible) well before
  // the reveal actually happens (see app/summary.tsx), so "on mount"
  // would fire the celebration while nobody can see it yet.
  active: boolean;
  children: ReactNode;
};

// A restrained, fast result cue wrapped around the Round Result verdict:
// a quick radial particle burst on PASS, a brief shake on FAIL. Both are
// skipped entirely when the OS "Reduce Motion" setting is on.
export function ResultCelebration({ passed, active, children }: ResultCelebrationProps) {
  const reducedMotion = useReducedMotion();

  // One shared value drives every particle (see Particle below) instead
  // of each particle owning its own — the burst only ever needs two
  // shared values total in this whole component.
  const progress = useSharedValue(0);
  const shakeX = useSharedValue(0);

  // Each particle's direction/distance/color is a fixed plain number,
  // computed once on mount — not itself animated.
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const distance = 36 + Math.random() * 28;
        const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];
        return { angle, distance, color };
      }),
    []
  );

  useEffect(() => {
    if (!active || reducedMotion) return;

    if (passed) {
      progress.value = withTiming(1, { duration: BURST_DURATION_MS, easing: motionEasing });
    } else {
      shakeX.value = withSequence(
        withTiming(-6, { duration: SHAKE_STEP_MS / 2, easing: motionEasing }),
        withTiming(6, { duration: SHAKE_STEP_MS, easing: motionEasing }),
        withTiming(-4, { duration: SHAKE_STEP_MS, easing: motionEasing }),
        withTiming(0, { duration: SHAKE_STEP_MS, easing: motionEasing })
      );
    }
    // Fires once, the moment `active` turns true — not on every render,
    // and not if `passed` were ever to change under this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <View style={styles.wrap}>
      {passed &&
        !reducedMotion &&
        particles.map((particle, index) => <Particle key={index} progress={progress} {...particle} />)}
      <Animated.View style={passed ? undefined : shakeStyle}>{children}</Animated.View>
    </View>
  );
}

type ParticleProps = {
  progress: SharedValue<number>;
  angle: number;
  distance: number;
  color: string;
};

function Particle({ progress, angle, distance, color }: ParticleProps) {
  const style = useAnimatedStyle(() => {
    const traveled = progress.value * distance;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: Math.cos(angle) * traveled },
        { translateY: Math.sin(angle) * traveled },
        { scale: 1 - progress.value * 0.4 },
      ],
    };
  });

  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 5,
    height: 5,
    marginTop: -2.5,
    marginLeft: -2.5,
  },
});
