import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../../components/BodyText';
import { ColorSwatch } from '../../components/ColorSwatch';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ReadoutText } from '../../components/ReadoutText';
import { TickRule } from '../../components/TickRule';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useHistory, type DayRecord } from '../../context/HistoryContext';
import { PASS_THRESHOLD, PHOTOS_PER_ROUND, useRound } from '../../context/RoundContext';
import { getColorFact } from '../../lib/colorFacts';
import { nameColor } from '../../lib/colorName';
import { getDailyTarget } from '../../lib/dailyColor';

// A YYYY-MM-DD key in local time — matches the date-key shape every
// other context/screen already uses (RoundContext, StreakContext,
// HistoryContext, summary.tsx, calendar.tsx).
function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// How many milliseconds are left until the next local midnight, which is
// when tomorrow's target color takes over.
function msUntilNextMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// The wordmark + live countdown-to-next-drop — identical in both Today
// states, so the screen reads as one instrument no matter which state
// it's showing. The countdown value is one of the app's two data
// readouts (see ReadoutText) — the daily-drop timer.
function TopBar({ countdownMs }: { countdownMs: number }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.wordmark}>
        <HeroText style={styles.wordmarkTitle}>Gamut</HeroText>
        <Label style={styles.signature}>by Kuboptics</Label>
      </View>
      <View style={styles.countdown}>
        <View style={styles.liveDot} />
        <View>
          <Label style={styles.countdownLabel}>Next drop</Label>
          <ReadoutText style={styles.countdownValue}>{formatCountdown(countdownMs)}</ReadoutText>
        </View>
      </View>
    </View>
  );
}

// Frames a child with four corner brackets, like a specimen slide or a
// viewfinder — the "signature moment" treatment CLAUDE.md asks for
// around today's target color.
function SpecimenFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.specimenFrame}>
      <View style={[styles.tick, styles.tickTL]} />
      <View style={[styles.tick, styles.tickTR]} />
      <View style={[styles.tick, styles.tickBL]} />
      <View style={[styles.tick, styles.tickBR]} />
      {children}
    </View>
  );
}

// A row of thumbnails of the photos banked so far this round — tapping
// one opens it larger. Empty slots (not yet submitted) are just a
// hairline-bordered square. Never shows a score, only the photos.
function RoundProgress({ photoUris }: { photoUris: string[] }) {
  const router = useRouter();

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: PHOTOS_PER_ROUND }).map((_, index) => {
        const photoUri = photoUris[index];
        if (!photoUri) {
          return <View key={index} style={styles.thumbnailEmpty} />;
        }
        return (
          <PressableOpacity
            key={index}
            onPress={() => router.push({ pathname: '/photo-viewer', params: { photoUri } })}
          >
            <Image source={{ uri: photoUri }} style={styles.thumbnail} />
          </PressableOpacity>
        );
      })}
    </View>
  );
}

// A small geometric aperture/lens mark — concentric hairline rings with
// radial tick marks, like a focus ring. A precise technical accent, not
// an illustration, reinforcing the "instrument" feel near the capture
// button. The outer ring and center dot are the app's one deliberate
// red signal accent (CLAUDE.md). Capture-state only — it's about
// focusing before a shot, so it doesn't belong in the completed state.
const APERTURE_SIZE = 40;
const APERTURE_TICK_COUNT = 8;

function ApertureMark() {
  return (
    <View style={styles.apertureWrap}>
      <View style={styles.apertureOuterRing} />
      <View style={styles.apertureInnerRing} />
      <View style={styles.apertureCenterDot} />
      {Array.from({ length: APERTURE_TICK_COUNT }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.apertureTick,
            { transform: [{ rotate: `${(360 / APERTURE_TICK_COUNT) * index}deg` }, { translateY: -APERTURE_SIZE / 2 }] },
          ]}
        />
      ))}
    </View>
  );
}

// The "Today" screen: dispatches between the pre-round capture flow and
// the completed-day result. The result is based on HistoryContext (not
// live RoundContext, which resets once a round is safely recorded —
// see app/summary.tsx), EXCEPT a retake in progress always wins: the
// player can redo today's round as many times as they want (see
// CompletedToday's "Retake Photos"), and each finished retake replaces
// the day's history record. `scores.length > 0` is the signal that a
// retake is actively underway — without it, returning to this tab
// mid-retake would show the previous completed result instead of the
// in-progress capture flow.
export default function TodayScreen() {
  const { history } = useHistory();
  const { scores } = useRound();
  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());

  // Tick the countdown once a second — shared by both states.
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayRecord = history[todayKey()];
  const isRetaking = scores.length > 0;

  return todayRecord && !isRetaking ? (
    <CompletedToday record={todayRecord} countdownMs={countdownMs} />
  ) : (
    <CaptureToday countdownMs={countdownMs} />
  );
}

// State 1: no round recorded for today yet — the capture flow, from an
// empty round through banking each of the 3 photos.
function CaptureToday({ countdownMs }: { countdownMs: number }) {
  const router = useRouter();
  const { scores, photoUris, isLoaded } = useRound();
  const target = getDailyTarget();
  const colorName = nameColor(target.hue, target.saturation, target.lightness);
  const colorFact = getColorFact(target);

  const bankedCount = scores.length;
  const isRoundComplete = bankedCount >= PHOTOS_PER_ROUND;
  const primaryLabel = isRoundComplete ? 'See Results' : bankedCount === 0 ? 'Start Round' : 'Add Photo';

  function handlePrimaryAction() {
    router.push(isRoundComplete ? '/summary' : '/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopBar countdownMs={countdownMs} />

      <Panel style={styles.specimenPanel}>
        <SpecimenFrame>
          <ColorSwatch hex={target.hex} size="large" />
        </SpecimenFrame>
        <ReadoutText style={styles.specimenHex}>{target.hex}</ReadoutText>
        <Label>{colorName}</Label>
        <BodyText style={styles.colorFact} numberOfLines={2}>
          {colorFact}
        </BodyText>
      </Panel>

      <Panel style={styles.controlsPanel}>
        {!isLoaded && <Label style={styles.roundInfo}>Loading…</Label>}

        {isLoaded && (
          <>
            <RoundProgress photoUris={photoUris} />
            <Label style={styles.roundInfo}>
              {bankedCount} of {PHOTOS_PER_ROUND} submitted
            </Label>

            <TickRule />

            <ApertureMark />

            <PrimaryButton label={primaryLabel} onPress={handlePrimaryAction} />
          </>
        )}
      </Panel>
    </SafeAreaView>
  );
}

// State 2: today's round is recorded — the color, the three photos and
// their scores, and the overall verdict, until the next drop.
function CompletedToday({ record, countdownMs }: { record: DayRecord; countdownMs: number }) {
  const router = useRouter();
  const colorName = nameColor(record.hue, record.saturation, record.lightness);
  const passed = record.outcome === 'passed';

  return (
    <SafeAreaView style={styles.container}>
      <TopBar countdownMs={countdownMs} />

      <Panel style={styles.specimenPanel}>
        <SpecimenFrame>
          <ColorSwatch hex={record.hex} size="large" />
        </SpecimenFrame>
        <ReadoutText style={styles.specimenHex}>{record.hex}</ReadoutText>
        <Label>{colorName}</Label>
        <HeroText style={[styles.verdict, passed ? styles.verdictPass : styles.verdictFail]}>
          {passed ? 'PASS' : 'FAIL'}
        </HeroText>
      </Panel>

      <Panel style={styles.controlsPanel}>
        <View style={styles.photoStrip}>
          {record.photoUris.map((uri, index) => {
            const score = record.scores[index];
            const shotPassed = score >= PASS_THRESHOLD;
            return (
              <PressableOpacity
                key={index}
                style={styles.photoCell}
                onPress={() => router.push({ pathname: '/photo-viewer', params: { photoUri: uri } })}
              >
                <Image source={{ uri }} style={styles.photoThumb} />
                <View style={styles.photoScoreRow}>
                  <BodyText style={styles.photoScoreValue}>{score}%</BodyText>
                  <View style={[styles.statusDot, shotPassed ? styles.statusDotPass : styles.statusDotFail]} />
                </View>
              </PressableOpacity>
            );
          })}
        </View>

        <TickRule />

        <PrimaryButton label="Retake Photos" onPress={() => router.push('/capture')} />
      </Panel>
    </SafeAreaView>
  );
}

const TICK_SIZE = 18;
const THUMBNAIL_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  wordmark: {
    alignItems: 'flex-start',
  },
  // Today's screen title, in effect — the brand wordmark gets the same
  // hero treatment every other screen's title uses.
  wordmarkTitle: {
    fontSize: 22,
  },
  signature: {
    fontSize: 10,
    marginTop: 2,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.signal,
  },
  countdownLabel: {
    textAlign: 'right',
  },
  countdownValue: {
    fontSize: typeScale.value,
    textAlign: 'right',
  },
  // Layout only — the surface fill/border/radius now come from Panel.
  specimenPanel: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  specimenFrame: {
    padding: spacing.lg,
  },
  tick: {
    position: 'absolute',
    width: TICK_SIZE,
    height: TICK_SIZE,
    borderColor: colors.textMuted,
  },
  tickTL: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  tickTR: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  tickBL: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  tickBR: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
  specimenHex: {
    fontSize: typeScale.specimen,
  },
  // Deliberately understated: muted color, small size, capped to two
  // lines, with breathing room from the color name above it — flavor
  // text for the negative space, not a competing headline. Body copy,
  // so it's Work Sans (BodyText), not the hero font.
  colorFact: {
    fontSize: typeScale.label,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  // The verdict is the same hero tier as the score it sits beside, so
  // it's Fugaz One (HeroText) rather than the Work Sans readout treatment.
  verdict: {
    fontSize: typeScale.specimen,
    marginTop: spacing.sm,
  },
  verdictPass: {
    color: colors.positive,
  },
  verdictFail: {
    color: colors.signal,
  },
  // Layout only — the surface fill/border/radius now come from Panel.
  controlsPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailEmpty: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundInfo: {
    textAlign: 'center',
  },
  apertureWrap: {
    alignSelf: 'center',
    width: APERTURE_SIZE,
    height: APERTURE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apertureOuterRing: {
    position: 'absolute',
    width: APERTURE_SIZE,
    height: APERTURE_SIZE,
    borderRadius: APERTURE_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.signal,
  },
  apertureInnerRing: {
    position: 'absolute',
    width: APERTURE_SIZE * 0.5,
    height: APERTURE_SIZE * 0.5,
    borderRadius: (APERTURE_SIZE * 0.5) / 2,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  apertureCenterDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.signal,
  },
  apertureTick: {
    position: 'absolute',
    top: APERTURE_SIZE / 2 - 2.5,
    left: APERTURE_SIZE / 2 - 0.5,
    width: 1,
    height: 5,
    backgroundColor: colors.border,
  },
  photoStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  // A nested layer of depth: a secondary-surface chip under each photo,
  // one step lighter than the panel it sits in. The chip (chrome) gets
  // the small radius; the photo itself stays hard-edged.
  photoCell: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.secondarySurface,
    borderRadius: radius.sm,
  },
  photoThumb: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  photoScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoScoreValue: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.label,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPass: {
    backgroundColor: colors.positive,
  },
  statusDotFail: {
    backgroundColor: colors.signal,
  },
});
