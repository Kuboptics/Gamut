import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorSwatch } from '../components/ColorSwatch';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { colors, spacing } from '../constants/theme';
import { nameColor } from '../lib/colorName';
import { getDailyTarget } from '../lib/dailyColor';
import type { Difficulty } from '../lib/scoring';

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

// The "Today" screen: the specimen slide showing today's target color,
// the difficulty toggle, and the button that starts a capture.
export default function TodayScreen() {
  const router = useRouter();
  const target = getDailyTarget();
  const colorName = nameColor(target.hue, target.saturation, target.lightness);

  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());

  // Tick the countdown once a second.
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>Color Hunt</Label>
        <View style={styles.countdownRow}>
          <View style={styles.liveDot} />
          <Label>Next drop {formatCountdown(countdownMs)}</Label>
        </View>
      </View>

      <View style={styles.specimen}>
        <ColorSwatch hex={target.hex} size="large" />
        <DotText style={styles.hex}>{target.hex}</DotText>
        <Label>{colorName}</Label>
      </View>

      <View style={styles.controls}>
        <View style={styles.difficultyRow}>
          <Label>Difficulty</Label>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => setDifficulty('normal')}
              style={[styles.toggleButton, difficulty === 'normal' && styles.toggleButtonActive]}
            >
              <Label style={difficulty === 'normal' && styles.toggleLabelActive}>Normal</Label>
            </Pressable>
            <Pressable
              onPress={() => setDifficulty('hard')}
              style={[styles.toggleButton, difficulty === 'hard' && styles.toggleButtonActive]}
            >
              <Label style={difficulty === 'hard' && styles.toggleLabelActive}>Hard</Label>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.captureButton}
          onPress={() => router.push({ pathname: '/capture', params: { difficulty } })}
        >
          <DotText style={styles.captureButtonText}>Capture</DotText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.signal,
  },
  specimen: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  hex: {
    fontSize: 20,
  },
  controls: {
    gap: spacing.lg,
  },
  difficultyRow: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.surface,
  },
  toggleLabelActive: {
    color: colors.textPrimary,
  },
  captureButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  captureButtonText: {
    fontSize: 20,
  },
});
