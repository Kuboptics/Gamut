import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BodyText } from '../components/BodyText';
import { HeroText } from '../components/HeroText';
import { Label } from '../components/Label';
import { Panel } from '../components/Panel';
import { PressableOpacity } from '../components/PressableOpacity';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCelebration } from '../components/ResultCelebration';
import { motionDuration, motionEasing, REVEAL_STAGGER_MS } from '../constants/motion';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useHistory } from '../context/HistoryContext';
import { PASS_THRESHOLD, useRound } from '../context/RoundContext';
import { useSync } from '../context/SyncContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getDailyTarget } from '../lib/dailyColor';

// A YYYY-MM-DD key in local time — matches the same date-key shape used
// by RoundContext, StreakContext, and HistoryContext.
function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  const { scores, photoUris, resetRound } = useRound();
  const { recordDay } = useHistory();
  const { pushRecord } = useSync();
  const target = getDailyTarget();

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const passed = average >= PASS_THRESHOLD;

  // Records the full day's record (for the Calendar screen, day-detail
  // view, and the streak — see StreakContext, which derives the streak
  // from history rather than needing a separate call here) exactly once,
  // the moment the result is revealed. The ref guard (rather than relying
  // only on the effect's dependency array) makes this robust even if
  // recordDay ever changes identity between renders — it can only run the
  // body once per time this screen is mounted, full stop.
  const hasRecordedRef = useRef(false);
  useEffect(() => {
    if (hasRecordedRef.current) return;
    hasRecordedRef.current = true;

    const dateKey = todayKey();
    const stored = recordDay(dateKey, {
      outcome: passed ? 'passed' : 'failed',
      hex: target.hex,
      hue: target.hue,
      saturation: target.saturation,
      lightness: target.lightness,
      scores,
      photoUris,
    });
    pushRecord(dateKey, stored);
  }, [passed, recordDay, pushRecord, target.hex, target.hue, target.saturation, target.lightness, scores, photoUris]);

  // The average counts up from 0 rather than snapping straight to its
  // final value — a plain requestAnimationFrame loop driving React
  // state, not Reanimated, since it's animating a number rather than a
  // style. Skips straight to the final value under reduced motion.
  const reducedMotion = useReducedMotion();
  const [displayedAverage, setDisplayedAverage] = useState(0);
  useEffect(() => {
    if (reducedMotion) {
      setDisplayedAverage(average);
      return;
    }

    const duration = 700;
    let startTime: number | null = null;
    let frameId: number;

    function tick(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayedAverage(Math.round(eased * average));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [average, reducedMotion]);

  // The round is now saved in history, photos included — resetRound no
  // longer needs to (and must not) delete those photo files, since the
  // day-detail view reads them straight from the history record.
  function handleRetry() {
    resetRound({ keepPhotos: true });
    router.replace('/capture');
  }

  function handleDone() {
    resetRound({ keepPhotos: true });
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HeroText style={styles.title}>Round Result</HeroText>
      </View>

      <Panel style={styles.body}>
        <Animated.View entering={revealStep(0)}>
          <ResultCelebration passed={passed}>
            <HeroText style={[styles.verdict, passed ? styles.pass : styles.fail]}>
              {passed ? 'PASS' : 'FAIL'}
            </HeroText>
          </ResultCelebration>
        </Animated.View>

        <Animated.View entering={revealStep(1)}>
          <HeroText style={styles.average}>{displayedAverage}%</HeroText>
        </Animated.View>

        <Animated.View entering={revealStep(2)}>
          <Label>Average of {scores.length} shots</Label>
        </Animated.View>

        <Animated.View style={styles.scoreList} entering={revealStep(3)}>
          {scores.map((score, index) => (
            <View key={index} style={styles.scoreRow}>
              <Label>Shot {index + 1}</Label>
              <BodyText style={styles.scoreValue}>{score}%</BodyText>
            </View>
          ))}
        </Animated.View>
      </Panel>

      <View style={styles.actions}>
        {passed ? (
          <PrimaryButton label="Done" onPress={handleDone} />
        ) : (
          <>
            <PrimaryButton label="Retry" onPress={handleRetry} />
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
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: typeScale.specimen,
  },
  // Layout only — the surface fill/border/radius now come from Panel.
  body: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  // The verdict is the same hero tier as the score beside it — Fugaz
  // One (HeroText), green/red matching the Today completed state.
  verdict: {
    fontSize: typeScale.specimen,
    marginBottom: spacing.sm,
  },
  pass: {
    color: colors.positive,
  },
  fail: {
    color: colors.signal,
  },
  // The big score/percentage — Fugaz One (HeroText), not the Work Sans
  // readout treatment (that's reserved for the hex code and countdown).
  average: {
    fontSize: typeScale.display,
  },
  scoreList: {
    marginTop: spacing.xl,
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // A small list-row value, not a hero moment — Work Sans (BodyText).
  scoreValue: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.value,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
