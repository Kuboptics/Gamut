import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../../components/BodyText';
import { ColorSwatch } from '../../components/ColorSwatch';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ReadoutText } from '../../components/ReadoutText';
import { StatusDot } from '../../components/StatusDot';
import { TickRule } from '../../components/TickRule';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useHistory, type DayRecord } from '../../context/HistoryContext';
import { PASS_THRESHOLD, PHOTOS_PER_ROUND, useRound, type RoundSlots } from '../../context/RoundContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
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

// A row of the round's 3 slots — every tile is tappable, filled or not,
// and always jumps to Capture for that specific slot: an empty tile
// starts it fresh, a filled one retakes it, leaving the other two
// slots untouched. Never shows a score, only the photos.
function RoundProgress({ slots }: { slots: RoundSlots }) {
  const router = useRouter();

  function handlePress(index: number) {
    router.push({ pathname: '/capture', params: { slot: String(index) } });
  }

  return (
    <View style={styles.progressRow}>
      {slots.map((slot, index) => {
        if (!slot) {
          return (
            <PressableOpacity key={index} onPress={() => handlePress(index)}>
              <View style={styles.thumbnailEmpty} />
            </PressableOpacity>
          );
        }
        return (
          <PressableOpacity key={index} onPress={() => handlePress(index)}>
            <Image source={{ uri: slot }} style={styles.thumbnail} />
          </PressableOpacity>
        );
      })}
    </View>
  );
}

// A small geometric aperture/lens mark — concentric hairline rings with
// radial tick marks, like a focus ring. A precise technical accent, not
// an illustration, reinforcing the "instrument" feel near the capture
// button — monochrome throughout, since it's decorative, not a signal
// (see CLAUDE.md for the short list of what red is actually reserved
// for). Capture-state only — it's about focusing before a shot, so it
// doesn't belong in the completed state.
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
// the completed-day result, purely based on whether HistoryContext has
// today's record yet. Once a round is submitted (see app/summary.tsx),
// it's locked for the day — there's no way back into the capture flow
// until tomorrow's color, so this is a plain either/or with no special
// cases.
export default function TodayScreen() {
  const { history } = useHistory();
  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());

  // Tick the countdown once a second — shared by both states.
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayRecord = history[todayKey()];
  const swipeHandlers = useTabSwipe(0);

  return (
    <View style={styles.swipeArea} {...swipeHandlers}>
      {todayRecord ? (
        <CompletedToday record={todayRecord} countdownMs={countdownMs} />
      ) : (
        <CaptureToday countdownMs={countdownMs} />
      )}
    </View>
  );
}

// State 1: no round recorded for today yet — the capture flow, from an
// empty round through banking each of the 3 photos.
function CaptureToday({ countdownMs }: { countdownMs: number }) {
  const router = useRouter();
  const { slots, isLoaded } = useRound();
  const target = getDailyTarget();
  const colorName = nameColor(target.hue, target.saturation, target.lightness);
  const colorFact = getColorFact(target);

  const bankedCount = slots.filter((slot) => slot !== null).length;
  const isRoundComplete = bankedCount >= PHOTOS_PER_ROUND;
  const primaryLabel = isRoundComplete ? 'Submit Round' : bankedCount === 0 ? 'Start Round' : 'Add Photo';

  function handlePrimaryAction() {
    Haptics.selectionAsync().catch(() => {});
    if (isRoundComplete) {
      // Submitting is final — there's no more retaking after this, so a
      // brief confirmation gates the one irreversible step in the app.
      Alert.alert(
        'Submit Round?',
        "You won't be able to retake any photos after this — today's result will be final.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', style: 'destructive', onPress: () => router.push('/summary') },
        ]
      );
      return;
    }
    // The linear shortcut: jump straight to the first slot that isn't
    // filled yet, rather than making the player pick one themselves.
    const nextEmptySlot = slots.findIndex((slot) => slot === null);
    router.push({ pathname: '/capture', params: { slot: String(nextEmptySlot) } });
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
            <RoundProgress slots={slots} />
            <Label style={styles.roundInfo}>
              {bankedCount} of {PHOTOS_PER_ROUND} captured
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

// State 2: today's round has been submitted — the color, the three
// photos and their scores, and the overall verdict, until the next
// drop. This is final: submitting locked the day, so tapping a photo
// just views it larger (as any past day's photo does from Calendar) —
// there's no retaking it anymore.
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
        <Label style={styles.breakdownHeader}>Breakdown</Label>

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
                  <StatusDot passed={shotPassed} />
                </View>
              </PressableOpacity>
            );
          })}
        </View>

        <View style={styles.lockedRow}>
          <Ionicons name="lock-closed" size={12} color={colors.signal} />
          <Label style={styles.lockedLabel}>Locked until tomorrow&apos;s color</Label>
        </View>
      </Panel>
    </SafeAreaView>
  );
}

const TICK_SIZE = 18;
const THUMBNAIL_SIZE = 56;

const styles = StyleSheet.create({
  swipeArea: {
    flex: 1,
  },
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
    // Fixed height, never shrinks — the specimen panel below flexes
    // instead, so its content can never push up over this row.
    flexShrink: 0,
  },
  wordmark: {
    alignItems: 'flex-start',
  },
  // Today's screen title, in effect — the brand wordmark. Unlike every
  // other HeroText usage, this one stays Fugaz One (fonts.wordmark),
  // the one deliberate exception to the app-wide switch to the system
  // font — see constants/theme.ts.
  wordmarkTitle: {
    ...fonts.wordmark,
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
  // overflow: 'hidden' is a safety net: if the swatch below ever miscalculates
  // its size, it gets visibly clipped to this card instead of covering the
  // header above it.
  specimenPanel: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    overflow: 'hidden',
  },
  // Flexes to fill whatever vertical space is left in specimenPanel once
  // its other children (hex readout, name, fact/verdict) take theirs —
  // that's the "available height" ColorSwatch's large size fills. width:
  // '100%' hands it the panel's full inner width as the other constraint,
  // so the swatch shrinks to fit both, however short or narrow the screen.
  specimenFrame: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: -0.5,
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
    letterSpacing: -0.5,
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
    borderColor: colors.textPrimary,
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
    backgroundColor: colors.textPrimary,
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
    ...fonts.primarySemiBold,
    fontSize: typeScale.label,
    fontVariant: ['tabular-nums'],
  },
  // A small header above the per-photo scores, once the round's in — the
  // Label style already used for every other small caption in the app.
  breakdownHeader: {
    textAlign: 'center',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  lockedLabel: {
    color: colors.signal,
  },
});
