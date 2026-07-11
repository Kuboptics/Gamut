import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Divider } from '../../components/Divider';
import { DotText } from '../../components/DotText';
import { Label } from '../../components/Label';
import { colors, spacing, typeScale } from '../../constants/theme';
import { PASS_THRESHOLD, PHOTOS_PER_ROUND, useRound } from '../../context/RoundContext';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Builds a 7-wide grid of day numbers for the given month, padded with
// nulls so the first day lands under the correct weekday column.
function getMonthGrid(date: Date): (number | null)[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// A month grid showing today's round status. There's no local history
// storage yet (that's a later phase), so only today gets a real
// pass/fail mark — past days are shown plainly rather than faked.
export default function CalendarScreen() {
  const { scores } = useRound();

  const today = new Date();
  const weeks = getMonthGrid(today);
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const isRoundComplete = scores.length >= PHOTOS_PER_ROUND;
  const average = isRoundComplete ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
  const passed = average !== null && average >= PASS_THRESHOLD;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>Calendar</Label>
        <DotText style={styles.month}>{monthLabel}</DotText>
      </View>

      <Divider />

      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <View key={index} style={styles.dayCell}>
              <Label>{label}</Label>
            </View>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              const isToday = day === today.getDate();
              return (
                <View key={dayIndex} style={styles.dayCell}>
                  {day !== null && (
                    <>
                      <DotText style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{day}</DotText>
                      {isToday && isRoundComplete && (
                        <View style={[styles.dayDot, passed ? styles.dayDotPass : styles.dayDotFail]} />
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Divider />

      <View style={styles.footer}>
        <Label style={styles.footerNote}>Past days aren't tracked yet</Label>
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
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  month: {
    fontSize: typeScale.value,
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dayNumber: {
    fontSize: typeScale.value,
    color: colors.textMuted,
  },
  dayNumberToday: {
    color: colors.textPrimary,
  },
  dayDot: {
    width: 5,
    height: 5,
  },
  dayDotPass: {
    backgroundColor: colors.textPrimary,
  },
  dayDotFail: {
    backgroundColor: colors.signal,
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
