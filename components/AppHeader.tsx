import { StyleSheet, View } from 'react-native';

import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { formatCountdown } from '../lib/countdown';
import { HeroText } from './HeroText';
import { Label } from './Label';
import { ReadoutText } from './ReadoutText';

// The wordmark + live countdown-to-next-drop — shown once, above every
// tab (see app/(tabs)/_layout.tsx), so it reads as one instrument
// regardless of which tab is showing. The countdown itself is one of the
// app's two data readouts (see ReadoutText) — the daily-drop timer. The
// layout owns the single ticking timer and just passes the current value
// down here; this component only formats and renders it.
export function AppHeader({ countdownMs }: { countdownMs: number }) {
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

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  wordmark: {
    alignItems: 'flex-start',
  },
  // The brand wordmark. Unlike every other HeroText usage, this one stays
  // Fugaz One (fonts.wordmark), the one deliberate exception to the
  // app-wide switch to the system font — see constants/theme.ts.
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
});
