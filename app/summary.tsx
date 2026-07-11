import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { motionDuration, motionEasing, REVEAL_STAGGER_MS } from '../constants/motion';
import { colors, spacing, typeScale } from '../constants/theme';
import { PASS_THRESHOLD, useRound } from '../context/RoundContext';
import { useStreak } from '../context/StreakContext';

// The reveal fades in one beat at a time — verdict, then average, then
// the caption, then the individual shots — rather than appearing all at
// once. Reanimated's FadeIn already respects the OS "Reduce Motion"
// setting by default, so no extra handling is needed here. Duration and
// easing come from the app's one shared set of motion values.
function revealStep(step: number) {
  return FadeIn.delay(step * REVEAL_STAGGER_MS).duration(motionDuration.base).easing(motionEasing);
}

// The final screen after a 3-photo round: every shot's score, the
// average, and the PASS/FAIL verdict.
export default function SummaryScreen() {
  const router = useRouter();
  const { scores, resetRound } = useRound();
  const { recordPass } = useStreak();

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const passed = average >= PASS_THRESHOLD;

  // Record the streak once, the moment a passing result is revealed.
  useEffect(() => {
    if (passed) recordPass();
  }, [passed, recordPass]);

  function handleRetry() {
    resetRound();
    router.replace('/capture');
  }

  function handleDone() {
    resetRound();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>Round Result</Label>
      </View>

      <Divider />

      <View style={styles.body}>
        <Animated.View entering={revealStep(0)}>
          <DotText style={[styles.verdict, passed ? styles.pass : styles.fail]}>
            {passed ? 'PASS' : 'FAIL'}
          </DotText>
        </Animated.View>

        <Animated.View entering={revealStep(1)}>
          <DotText style={styles.average}>{average}%</DotText>
        </Animated.View>

        <Animated.View entering={revealStep(2)}>
          <Label>Average of {scores.length} shots</Label>
        </Animated.View>

        <Animated.View style={styles.scoreList} entering={revealStep(3)}>
          {scores.map((score, index) => (
            <View key={index} style={styles.scoreRow}>
              <Label>Shot {index + 1}</Label>
              <DotText style={styles.scoreValue}>{score}%</DotText>
            </View>
          ))}
        </Animated.View>
      </View>

      <Divider />

      <View style={styles.actions}>
        {passed ? (
          <PressableOpacity style={styles.primaryButton} onPress={handleDone}>
            <DotText style={styles.primaryButtonText}>Done</DotText>
          </PressableOpacity>
        ) : (
          <>
            <PressableOpacity style={styles.primaryButton} onPress={handleRetry}>
              <DotText style={styles.primaryButtonText}>Retry</DotText>
            </PressableOpacity>
            <PressableOpacity style={styles.secondaryButton} onPress={handleDone}>
              <Label>Back to Today</Label>
            </PressableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  verdict: {
    fontSize: typeScale.specimen,
    marginBottom: spacing.sm,
  },
  pass: {
    color: colors.textPrimary,
  },
  fail: {
    color: colors.signal,
  },
  average: {
    fontSize: typeScale.display,
  },
  scoreList: {
    marginTop: spacing.xl,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreValue: {
    fontSize: typeScale.value,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  primaryButtonText: {
    fontSize: typeScale.button,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
