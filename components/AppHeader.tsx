import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useCountdown } from '../lib/CountdownContext';
import { formatCountdown } from '../lib/countdown';
import { HeroText } from './HeroText';
import { Label } from './Label';
import { ReadoutText } from './ReadoutText';

// The wordmark + live countdown-to-next-drop — rendered at the top of
// every tab screen (see app/(tabs)/index.tsx, progress.tsx, friends.tsx,
// settings.tsx) so it reads as one instrument regardless of which tab is
// showing. It used to live once in the shared layout above the old JS tab
// bar, but NativeTabs (the system tab bar) has to be the top-level element
// in the layout, so each screen renders its own copy instead. The
// countdown value itself comes from CountdownContext, which owns the
// single ticking timer shared by every screen — this component only
// formats and renders it. Applies its own top safe-area inset (it used to
// rely on the layout's SafeAreaView for that).
export function AppHeader() {
  const countdownMs = useCountdown();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
  },
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
