import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorSwatch } from '../../components/ColorSwatch';
import { Divider } from '../../components/Divider';
import { DotText } from '../../components/DotText';
import { Label } from '../../components/Label';
import { PressableOpacity } from '../../components/PressableOpacity';
import { colors, spacing, typeScale } from '../../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../../context/RoundContext';
import { nameColor } from '../../lib/colorName';
import { getDailyTarget } from '../../lib/dailyColor';

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
// button.
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

// The "Today" screen: the specimen slide showing today's target color,
// and the button that continues the in-progress 3-photo round.
export default function TodayScreen() {
  const router = useRouter();
  const { scores, photoUris, isLoaded } = useRound();
  const target = getDailyTarget();
  const colorName = nameColor(target.hue, target.saturation, target.lightness);

  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());

  // Tick the countdown once a second.
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const bankedCount = scores.length;
  const isRoundComplete = bankedCount >= PHOTOS_PER_ROUND;
  const primaryLabel = isRoundComplete ? 'See Results' : bankedCount === 0 ? 'Start Round' : 'Add Photo';

  function handlePrimaryAction() {
    router.push(isRoundComplete ? '/summary' : '/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.wordmark}>
          <Label>Color Hunt</Label>
          {!isRoundComplete && <Label style={styles.signature}>by Kuboptics</Label>}
        </View>
        <View style={styles.countdown}>
          <View style={styles.liveDot} />
          <View>
            <Label style={styles.countdownLabel}>Next drop</Label>
            <DotText style={styles.countdownValue}>{formatCountdown(countdownMs)}</DotText>
          </View>
        </View>
      </View>

      <Divider />

      <View style={styles.specimenZone}>
        <SpecimenFrame>
          <ColorSwatch hex={target.hex} size="large" />
        </SpecimenFrame>
        <DotText style={styles.specimenHex}>{target.hex}</DotText>
        <Label>{colorName}</Label>
      </View>

      <Divider />

      <View style={styles.controls}>
        {!isLoaded && <Label style={styles.roundInfo}>Loading…</Label>}

        {isLoaded && (
          <>
            <RoundProgress photoUris={photoUris} />
            <Label style={styles.roundInfo}>
              {bankedCount} of {PHOTOS_PER_ROUND} submitted
            </Label>

            <ApertureMark />

            <PressableOpacity style={styles.captureButton} onPress={handlePrimaryAction}>
              <DotText style={styles.captureButtonText}>{primaryLabel}</DotText>
            </PressableOpacity>
          </>
        )}
      </View>
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
  specimenZone: {
    flex: 1,
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
  controls: {
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
    borderColor: colors.border,
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
    backgroundColor: colors.textMuted,
  },
  apertureTick: {
    position: 'absolute',
    top: APERTURE_SIZE / 2 - 2.5,
    left: APERTURE_SIZE / 2 - 0.5,
    width: 1,
    height: 5,
    backgroundColor: colors.border,
  },
  captureButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  captureButtonText: {
    fontSize: typeScale.button,
  },
});
