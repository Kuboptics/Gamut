import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorSwatch } from '../components/ColorSwatch';
import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';
import { nameColor } from '../lib/colorName';
import { getDailyTarget } from '../lib/dailyColor';

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

// The "Today" screen: the specimen slide showing today's target color,
// and the button that starts a 3-photo round.
export default function TodayScreen() {
  const router = useRouter();
  const { resetRound } = useRound();
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

  function handleStartRound() {
    // Clear out any previous (possibly abandoned) round before starting
    // a fresh one, so shot counting always begins at zero.
    resetRound();
    router.push('/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Label>Color Hunt</Label>
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
        <Label style={styles.roundInfo}>Round · {PHOTOS_PER_ROUND} photos</Label>

        <PressableOpacity style={styles.captureButton} onPress={handleStartRound}>
          <DotText style={styles.captureButtonText}>Start Round</DotText>
        </PressableOpacity>
      </View>
    </SafeAreaView>
  );
}

const TICK_SIZE = 18;

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
  roundInfo: {
    textAlign: 'center',
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
