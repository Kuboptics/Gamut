import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

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

  // The screen's one explicit phase. Sets exactly once, in the same
  // effect that records the round below — everything the render shows
  // (which layer is visible, whether the reveal has started) reads this
  // single value instead of independently re-deriving "are we done yet",
  // so the UI can never paint some in-between combination that wasn't
  // intended. `allScored` above still directly gates whether another
  // PhotoScorer should mount (see the render below) — that's immediate,
  // synchronous derived state, deliberately not routed through `status`,
  // which only updates a render later, inside the effect.
  const [status, setStatus] = useState<'calculating' | 'result'>('calculating');

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

    setStatus('result');
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
  // style. Skips straight to the final value under reduced motion. Gated
  // on `status` rather than `allScored` directly, so it starts at the
  // same moment as the reveal below rather than a render earlier.
  const reducedMotion = useReducedMotion();
  const [displayedAverage, setDisplayedAverage] = useState(0);
  useEffect(() => {
    if (status !== 'result') return;
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
  }, [average, status, reducedMotion]);

  // Cross-fades the calculating/result layers below, and staggers each of
  // the result's 4 pieces in behind it — the same stagger/duration/easing
  // the old entering={FadeIn...} props used, just driven explicitly so it
  // fires exactly once (when `status` flips to 'result') instead of
  // replaying on every re-render: these pieces stay mounted the whole
  // time now (see the render below) rather than mounting fresh at reveal
  // time, so a mount-time `entering` animation can't be used for them.
  const resultProgress = useSharedValue(0);
  const verdictOpacity = useSharedValue(0);
  const averageOpacity = useSharedValue(0);
  const captionOpacity = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  useEffect(() => {
    if (status !== 'result') return;

    if (reducedMotion) {
      resultProgress.value = 1;
      verdictOpacity.value = 1;
      averageOpacity.value = 1;
      captionOpacity.value = 1;
      listOpacity.value = 1;
      return;
    }

    resultProgress.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing });
    const steps = [verdictOpacity, averageOpacity, captionOpacity, listOpacity];
    steps.forEach((opacity, step) => {
      opacity.value = withDelay(step * REVEAL_STAGGER_MS, withTiming(1, { duration: motionDuration.base, easing: motionEasing }));
    });
    // Fires exactly once, the moment `status` flips to 'result'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const calculatingLayerStyle = useAnimatedStyle(() => ({ opacity: 1 - resultProgress.value }));
  const resultLayerStyle = useAnimatedStyle(() => ({ opacity: resultProgress.value }));
  const verdictStyle = useAnimatedStyle(() => ({ opacity: verdictOpacity.value }));
  const averageStyle = useAnimatedStyle(() => ({ opacity: averageOpacity.value }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: captionOpacity.value }));
  const listStyle = useAnimatedStyle(() => ({ opacity: listOpacity.value }));

  // Submitting is final either way — pass or fail, there's nothing left
  // to retry today, so this is the only action once revealed.
  function handleDone() {
    resetRound({ keepPhotos: true });
    router.replace('/');
  }

  if (!allFilled) return null; // bouncing to Today; nothing to show

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HeroText style={styles.title}>{status === 'result' ? 'Round Result' : 'Scoring…'}</HeroText>
      </View>

      {/* The result content drives this box's natural height — normal
          flow, never absolutely positioned — and its shape never changes
          after mount (see the fixed-length score list below), so that
          height is fixed for the rest of the screen's life. The
          calculating content is what's absolutely positioned, overlaid on
          top of it; switching between them is a pure opacity cross-fade
          that can't reflow anything, in either direction. */}
      <View style={styles.bodyArea}>
        <Panel style={styles.body}>
          <Animated.View
            style={[styles.resultContent, resultLayerStyle]}
            pointerEvents={status === 'result' ? 'auto' : 'none'}
          >
            <Animated.View style={verdictStyle}>
              <ResultCelebration passed={passed} active={status === 'result'}>
                <HeroText style={[styles.verdict, passed ? styles.pass : styles.fail]}>
                  {passed ? 'PASS' : 'FAIL'}
                </HeroText>
              </ResultCelebration>
            </Animated.View>

            <Animated.View style={averageStyle}>
              <HeroText style={styles.average}>{displayedAverage}%</HeroText>
            </Animated.View>

            <Animated.View style={captionStyle}>
              {/* Frozen at PHOTOS_PER_ROUND while calculating, not the live
                  (still-changing) scores.length — this text must not update
                  three separate times, once per shot, while this whole
                  layer sits invisibly underneath the calculating layer; it
                  only needs to be correct once, at the single moment it
                  actually becomes visible. */}
              <Label>Average of {status === 'result' ? scores.length : PHOTOS_PER_ROUND} shots</Label>
            </Animated.View>

            <Animated.View style={[styles.scoreList, listStyle]}>
              {/* Always PHOTOS_PER_ROUND rows, never scores.map(...) — the
                  row count (and therefore this block's height) must never
                  change as scoring progresses from 0 to 3 shots, since
                  that's exactly what was silently recentering the verdict/
                  average above it while this whole layer sat at opacity 0.
                  The values themselves are blank until `status` flips too,
                  for the same reason as the caption above: nothing in this
                  invisible layer should update three separate times while
                  scoring is still in progress. */}
              {Array.from({ length: PHOTOS_PER_ROUND }, (_, index) => {
                const score = status === 'result' ? scores[index] : undefined;
                return (
                  <View key={index} style={styles.scoreRow}>
                    <Label>Shot {index + 1}</Label>
                    <BodyText style={styles.scoreValue}>{score !== undefined ? `${score}%` : ''}</BodyText>
                  </View>
                );
              })}
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[styles.calculatingLayer, calculatingLayerStyle]}
            pointerEvents={status === 'calculating' ? 'auto' : 'none'}
          >
            <HeroText style={styles.title}>Scoring…</HeroText>
          </Animated.View>
        </Panel>
      </View>

      <View style={styles.actions}>
        <Animated.View style={resultLayerStyle} pointerEvents={status === 'result' ? 'auto' : 'none'}>
          <PrimaryButton label="Done" onPress={handleDone} />
        </Animated.View>
      </View>

      {/* Gated on `allScored` directly (not `status`, which only updates a
          render later inside the recording effect) — otherwise, on the one
          render where scoring just finished but `status` hasn't caught up
          yet, this would try to mount a 4th PhotoScorer for an out-of-range
          photo index. Deliberately no `key` here: PhotoScorer's own effect
          already re-runs correctly when `photoUri` changes, so keeping the
          same instance across all 3 photos lets the underlying WebView
          reload its content instead of being destroyed and recreated three
          times in a row while this screen is trying to look static. */}
      {!allScored && <PhotoScorer photoUri={photoUris[scores.length]} targetRgb={target.rgb} onScore={handleScore} />}
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
  // Centers the (content-sized — see styles.body) card in whatever
  // vertical room is actually available between the header and the
  // actions row, the same "measure isn't needed, just let the taller
  // content define the box" approach the Today screen's specimen card
  // uses.
  bodyArea: {
    flex: 1,
    marginBottom: spacing.lg,
    justifyContent: 'center',
  },
  // Layout only — the surface fill/border/radius come from Panel. No
  // flex: 1, no explicit height — its height is whatever styles
  // .resultContent's content naturally needs, which is always the taller
  // of the two states (see styles.resultContent), and never changes
  // after mount, so this box's height is fixed for the rest of the
  // screen's life.
  body: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  // Normal flow (not absolutely positioned) — this is what gives the
  // Panel its actual height. alignItems/gap here (not on the Panel
  // itself) center and space the 4 result pieces.
  resultContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Absolutely positioned over the (taller) result content above, so it
  // can never affect the Panel's own size — just an opacity-driven
  // overlay while calculating.
  calculatingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
