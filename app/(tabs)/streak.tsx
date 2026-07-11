import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Divider } from '../../components/Divider';
import { DotText } from '../../components/DotText';
import { Label } from '../../components/Label';
import { colors, spacing, typeScale } from '../../constants/theme';
import { useStreak } from '../../context/StreakContext';

// Shows the local day streak tracked in context/StreakContext.tsx. This
// is a real, on-device count (grows when a round is passed, resets on
// a missed day) — not a placeholder. A server-synced streak is a later
// phase once accounts exist.
export default function StreakScreen() {
  const { currentStreak, isLoaded } = useStreak();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>Streak</Label>
      </View>

      <Divider />

      <View style={styles.body}>
        {!isLoaded ? (
          <Label>Loading…</Label>
        ) : (
          <>
            <DotText style={styles.streakNumber}>{currentStreak}</DotText>
            <Label>{currentStreak === 1 ? 'Day' : 'Days'} in a row</Label>
          </>
        )}
      </View>

      <Divider />

      <View style={styles.footer}>
        <Label style={styles.footerNote}>Pass a round to grow your streak — miss a day and it resets</Label>
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  streakNumber: {
    fontSize: typeScale.display,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  footerNote: {
    textAlign: 'center',
  },
});
