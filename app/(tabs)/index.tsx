import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
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
import { wcagContrastTextColor } from '../../lib/color';
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

// How far the brackets sit outside the swatch's own edges — the wrapper
// below is always exactly this much bigger than the swatch, on every
// side, so the brackets can never overlap the swatch or float away from
// it (unlike a flex-grown wrapper, which can end up far larger than the
// swatch it's meant to frame).
const BRACKET_INSET = spacing.xl;

// The card's own breathing room around its content (the bracket-wrapper
// plus the footer text below it) — keeps the card's border away from the
// brackets, the same way BRACKET_INSET keeps the brackets away from the
// swatch. Also the single gap between the bracket-wrapper and the footer.
const CARD_PADDING = spacing.lg;
const CARD_GAP = spacing.lg;

// The card housing today's target color — the corner-bracket "specimen
// slide" treatment CLAUDE.md asks for. Sized to fit its content exactly
// (no flex growth, no fixed height) and centered in whatever vertical
// room is actually available above the controls panel. Measures that
// available room, and the footer's own rendered height, via onLayout
// (never a fixed pixel value or module-scope Dimensions), then computes
// an exact pixel size for the bracket-wrapper — whichever of available
// width/height is smaller — so the swatch inside it shrinks to fit on
// short screens without ever growing past the wrapper, and therefore
// never past the brackets either.
function SpecimenCard({ hex, colorName, footer }: { hex: string; colorName: string; footer: ReactNode }) {
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [footerHeight, setFooterHeight] = useState(0);

  function handleAreaLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setAvailable({ width, height });
  }

  function handleFooterLayout(event: LayoutChangeEvent) {
    setFooterHeight(event.nativeEvent.layout.height);
  }

  const verticalChrome = CARD_PADDING * 2 + CARD_GAP;
  const horizontalChrome = CARD_PADDING * 2;
  const wrapperSize = Math.max(
    0,
    Math.min(available.width - horizontalChrome, available.height - verticalChrome - footerHeight)
  );
  const swatchSize = Math.max(0, wrapperSize - BRACKET_INSET * 2);

  return (
    <View style={styles.specimenArea} onLayout={handleAreaLayout}>
      <Panel style={styles.specimenPanel}>
        <View style={[styles.bracketWrapper, { width: wrapperSize, height: wrapperSize }]}>
          <View style={[styles.tick, styles.tickTL]} />
          <View style={[styles.tick, styles.tickTR]} />
          <View style={[styles.tick, styles.tickBL]} />
          <View style={[styles.tick, styles.tickBR]} />
          <View style={[styles.swatchSlot, { width: swatchSize, height: swatchSize }]}>
            <ColorSwatch hex={hex} size="large">
              <SwatchLabel name={colorName} hex={hex} />
            </ColorSwatch>
          </View>
        </View>
        <View onLayout={handleFooterLayout}>{footer}</View>
      </Panel>
    </View>
  );
}

// The color name and hex, centered on the swatch itself. Name above, in
// Label's existing uppercase/tracked treatment but at a much larger size
// and bold weight — it's the focal point of the screen now. Hex below,
// in ReadoutText's existing tabular treatment, increased proportionally
// but still clearly secondary (smaller, dimmer). Both use the WCAG-
// luminance contrast flip (not a fixed color) since they sit directly on
// an arbitrary fill, not on black, and both shrink to fit rather than
// overflow on a long name or a narrow screen.
function SwatchLabel({ name, hex }: { name: string; hex: string }) {
  const textColor = wcagContrastTextColor(hex);
  return (
    <View style={styles.swatchLabel} pointerEvents="none">
      <Label style={[styles.swatchLabelName, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {name}
      </Label>
      <ReadoutText style={[styles.swatchLabelHex, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {hex}
      </ReadoutText>
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
  const todayRecord = history[todayKey()];
  const swipeHandlers = useTabSwipe(0);

  return (
    <View style={styles.swipeArea} {...swipeHandlers}>
      {todayRecord ? <CompletedToday record={todayRecord} /> : <CaptureToday />}
    </View>
  );
}

// State 1: no round recorded for today yet — the capture flow, from an
// empty round through banking each of the 3 photos.
function CaptureToday() {
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <SpecimenCard
        hex={target.hex}
        colorName={colorName}
        footer={
          <BodyText style={styles.colorFact} numberOfLines={2}>
            {colorFact}
          </BodyText>
        }
      />

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
function CompletedToday({ record }: { record: DayRecord }) {
  const router = useRouter();
  const colorName = nameColor(record.hue, record.saturation, record.lightness);
  const passed = record.outcome === 'passed';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <SpecimenCard
        hex={record.hex}
        colorName={colorName}
        footer={
          <HeroText style={[styles.verdict, passed ? styles.verdictPass : styles.verdictFail]}>
            {passed ? 'PASS' : 'FAIL'}
          </HeroText>
        }
      />

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
  // The flex:1 measuring area between the shared header and controlsPanel
  // — plain,
  // no surface/border of its own. SpecimenCard measures this via onLayout
  // to know how much room the card actually has, then centers the
  // card (sized to its own content, see specimenPanel below) inside it —
  // any leftover space here is neutral background, not dead space inside
  // the visible card.
  specimenArea: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  // The visible card: sized by its content (bracket-wrapper + footer),
  // not flex-grown and not a fixed height — CARD_PADDING is its own
  // breathing room, CARD_GAP the single gap before the footer. Width
  // still spans specimenArea's full (already-margined) width, matching
  // every other panel on this screen. overflow: 'hidden' is a safety net:
  // if the bracket-wrapper below ever miscalculates its size, it gets
  // visibly clipped to this card instead of covering the header above it.
  specimenPanel: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
    overflow: 'hidden',
  },
  // Sized to an exact pixel square by SpecimenCard: the swatch's size
  // plus BRACKET_INSET on every side, never a fixed value or aspectRatio
  // left to resolve itself. The four brackets are its direct children,
  // positioned at ITS corners (see tick* below) — so they sit exactly
  // BRACKET_INSET outside the swatch, on every screen size, and can never
  // be clipped by the card or overlap the swatch.
  bracketWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The swatch's immediate container, sized to an exact pixel square by
  // SpecimenCard — overflow: 'hidden' clips any future sizing error
  // instead of letting it paint over the brackets.
  swatchSlot: {
    overflow: 'hidden',
  },
  // Centered over the swatch fill (see SwatchLabel) — inset from the
  // swatch's own edges so long names shrink/wrap before ever reaching them.
  swatchLabel: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    maxWidth: '100%',
  },
  // The focal point of the screen — bold system font (fonts.display),
  // substantially larger than before. Label's own uppercase transform and
  // letterSpacing:2 are untouched, inherited from Label's base style;
  // this override only changes weight, font size, and alignment.
  swatchLabelName: {
    ...fonts.display,
    fontSize: 36,
    textAlign: 'center',
  },
  // Increased proportionally from before, but still clearly secondary —
  // smaller than the name above it, dimmer, and below it. Keeps
  // ReadoutText's existing tabular/letter-spacing treatment.
  swatchLabelHex: {
    fontSize: typeScale.value,
    letterSpacing: -0.5,
    opacity: 0.7,
    marginTop: spacing.xs,
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
  // Deliberately understated: muted color, small size, capped to two
  // lines — flavor text for the negative space below the specimen frame,
  // not a competing headline. Body copy, so it's Work Sans (BodyText),
  // not the hero font.
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
