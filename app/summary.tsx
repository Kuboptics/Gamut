import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BodyText } from '../components/BodyText';
import { HeroText } from '../components/HeroText';
import { Label } from '../components/Label';
import { Panel } from '../components/Panel';
import { PixelSampler } from '../components/PixelSampler';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCelebration } from '../components/ResultCelebration';
import { motionDuration, motionEasing, REVEAL_STAGGER_MS } from '../constants/motion';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useHistory } from '../context/HistoryContext';
import { PASS_THRESHOLD, PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';
import { useSync } from '../context/SyncContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { findBestPatch } from '../lib/bestPatch';
import type { RGB } from '../lib/color';
import { getDailyTarget } from '../lib/dailyColor';
import { scoreFromDistance } from '../lib/scoring';

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

// Scores exactly one photo — the same pipeline app/preview.tsx used to
// run per-photo the instant a shot was taken. Scoring now only happens
// here, at Submit, one photo at a time (see SummaryScreen below), rather
// than silently in the background while shooting. Renders nothing
// visible: PixelSampler is an invisible 1x1 WebView.
function PhotoScorer({ photoUri, targetRgb, onScore }: { photoUri: string; targetRgb: RGB; onScore: (score: number) => void }) {
  const [sampleImageUri, setSampleImageUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 200 } }], {
      base64: true,
      format: ImageManipulator.SaveFormat.JPEG,
    })
      .then((manipulated) => {
        if (!cancelled) setSampleImageUri(`data:image/jpeg;base64,${manipulated.base64}`);
      })
      .catch(() => {
        // Can't read this photo for some reason — score it 0 rather than
        // stalling the submit forever on one bad file.
        if (!cancelled) onScore(0);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUri]);

  function handleSample(tileColors: RGB[]) {
    const bestPatch = findBestPatch(tileColors, targetRgb);
    onScore(scoreFromDistance(bestPatch.distance));
  }

  return <PixelSampler imageUri={sampleImageUri} onSample={handleSample} onError={() => onScore(0)} />;
}

// The screen reached only by pressing "Submit Round" on Today, once all
// 3 slots are filled. This is the one and only place scoring, history
// recording, cloud sync, and thumbnail upload happen — nothing about a
// round exists anywhere else until this screen runs.
export default function SummaryScreen() {
  const router = useRouter();
  const { slots, resetRound } = useRound();
  const { recordDay } = useHistory();
  const { pushRecord, pushThumbnails } = useSync();
  const target = getDailyTarget();

  const photoUris = slots.filter((uri): uri is string => uri !== null);
  const allFilled = photoUris.length === PHOTOS_PER_ROUND;

  // Guards against ever reaching this screen with an incomplete round —
  // a stale deep link, a restored navigation state, anything — bouncing
  // back to Today instead of crashing on a missing photo. Submit is the
  // only real way in, and it never navigates here unless all 3 are full.
  useEffect(() => {
    if (!allFilled) router.replace('/');
  }, [allFilled, router]);

  const [scores, setScores] = useState<number[]>([]);
  const allScored = scores.length === PHOTOS_PER_ROUND;

  function handleScore(score: number) {
    setScores((current) => [...current, score]);
  }

  const average = allScored ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const passed = average >= PASS_THRESHOLD;

  // Records the full day's record (for the Calendar screen, day-detail
  // view, and the streak — see StreakContext, which derives the streak
  // from history rather than needing a separate call here), pushes it to
  // the cloud, and uploads thumbnails — exactly once, the moment scoring
  // finishes. The ref guard (rather than relying only on the effect's
  // dependency array) makes this robust even if recordDay ever changes
  // identity between renders — it can only run the body once per time
  // this screen is mounted, full stop.
  const hasRecordedRef = useRef(false);
  useEffect(() => {
    if (!allScored || hasRecordedRef.current) return;
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
    pushThumbnails(photoUris);

    // A success/warning notification haptic on reveal — one clear signal
    // for the one moment on this screen that actually matters.
    Haptics.notificationAsync(
      passed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
  }, [
    allScored,
    passed,
    recordDay,
    pushRecord,
    pushThumbnails,
    target.hex,
    target.hue,
    target.saturation,
    target.lightness,
    scores,
    photoUris,
  ]);

  // The average counts up from 0 rather than snapping straight to its
  // final value — a plain requestAnimationFrame loop driving React
  // state, not Reanimated, since it's animating a number rather than a
  // style. Skips straight to the final value under reduced motion.
  const reducedMotion = useReducedMotion();
  const [displayedAverage, setDisplayedAverage] = useState(0);
  useEffect(() => {
    if (!allScored) return;
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
  }, [average, allScored, reducedMotion]);

  // Submitting is final either way — pass or fail, there's nothing left
  // to retry today, so this is the only action once revealed.
  function handleDone() {
    resetRound({ keepPhotos: true });
    router.replace('/');
  }

  if (!allFilled) return null; // bouncing to Today; nothing to show

  if (!allScored) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scoringBody}>
          <HeroText style={styles.title}>Scoring…</HeroText>
        </View>
        <PhotoScorer key={scores.length} photoUri={photoUris[scores.length]} targetRgb={target.rgb} onScore={handleScore} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HeroText style={styles.title}>Round Result</HeroText>
      </View>

      <Panel style={styles.body} hue={target.hue}>
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
        <PrimaryButton label="Done" onPress={handleDone} />
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
    letterSpacing: -0.5,
  },
  scoringBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: -0.5,
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
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
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
    ...fonts.primarySemiBold,
    fontSize: typeScale.value,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
});
