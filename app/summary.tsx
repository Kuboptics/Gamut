import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';
import { PASS_THRESHOLD, useRound } from '../context/RoundContext';

// The final screen after a 3-photo round: every shot's score, the
// average, and the PASS/FAIL verdict.
export default function SummaryScreen() {
  const router = useRouter();
  const { scores, resetRound } = useRound();

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const passed = average >= PASS_THRESHOLD;

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
        <DotText style={[styles.verdict, passed ? styles.pass : styles.fail]}>
          {passed ? 'PASS' : 'FAIL'}
        </DotText>

        <DotText style={styles.average}>{average}%</DotText>
        <Label>Average of {scores.length} shots</Label>

        <View style={styles.scoreList}>
          {scores.map((score, index) => (
            <View key={index} style={styles.scoreRow}>
              <Label>Shot {index + 1}</Label>
              <DotText style={styles.scoreValue}>{score}%</DotText>
            </View>
          ))}
        </View>
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
