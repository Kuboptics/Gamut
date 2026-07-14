import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../../components/BodyText';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { TickRule } from '../../components/TickRule';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useHistory, type DayRecord } from '../../context/HistoryContext';
import { useStreak } from '../../context/StreakContext';
import { contrastTextColor } from '../../lib/color';

// A YYYY-MM-DD key in local time — matches the key shape HistoryContext
// stores records under.
function dateKeyFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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

const CHAIN_DAYS = 7;

// A row of small tiles, one per of the last 7 days (today included) —
// green for a pass, red for a fail/missed day, muted for no data, and a
// small red outline on today specifically while it's still unplayed.
// Pulled straight from HistoryContext, so it's never out of sync with
// the calendar below it.
function StreakChain({ history }: { history: Record<string, DayRecord> }) {
  const today = new Date();

  return (
    <View style={styles.chainRow}>
      {Array.from({ length: CHAIN_DAYS }).map((_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (CHAIN_DAYS - 1 - index));
        const dateKey = dateKeyFor(date.getFullYear(), date.getMonth(), date.getDate());
        const record = history[dateKey];
        const isToday = index === CHAIN_DAYS - 1;

        return (
          <View
            key={index}
            style={[
              styles.chainTile,
              record?.outcome === 'passed' && styles.chainTilePass,
              record?.outcome === 'failed' && styles.chainTileFail,
              !record && isToday && styles.chainTileLive,
            ]}
          />
        );
      })}
    </View>
  );
}

// The merged "Progress" screen: the streak (and its last-7-days chain)
// at the top, the month calendar below it — one scrolling pair of
// instrument panels instead of two separate tabs.
export default function ProgressScreen() {
  const router = useRouter();
  const { currentStreak, isLoaded: streakLoaded } = useStreak();
  const { history } = useHistory();
  const isActive = streakLoaded && currentStreak > 0;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const weeks = getMonthGrid(today);
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HeroText style={styles.title}>Progress</HeroText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Panel style={styles.streakPanel}>
          {!streakLoaded ? (
            <Label>Loading…</Label>
          ) : (
            <>
              <View style={styles.countRow}>
                {isActive && <View style={styles.liveDot} />}
                <HeroText style={styles.streakNumber}>{currentStreak}</HeroText>
              </View>
              <Label>{currentStreak === 1 ? 'Day' : 'Days'} in a row</Label>
              <TickRule />
              <StreakChain history={history} />
            </>
          )}
        </Panel>

        <Panel style={styles.calendarPanel}>
          <BodyText style={styles.month}>{monthLabel}</BodyText>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <View key={index} style={styles.dayCell}>
                <Label>{label}</Label>
              </View>
            ))}
          </View>

          <TickRule />

          <View style={styles.daysGrid}>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return <View key={dayIndex} style={styles.dayCell} />;
                  }

                  const isToday = day === today.getDate();
                  const dateKey = dateKeyFor(year, month, day);
                  const record = history[dateKey];
                  const isTodayLive = isToday && !record;
                  const numberColor = record ? contrastTextColor(record.hex) : null;

                  const tileStyle = [
                    styles.dayTile,
                    record ? { backgroundColor: record.hex } : null,
                    record?.outcome === 'passed' ? styles.dayTilePass : null,
                    record?.outcome === 'failed' ? styles.dayTileFail : null,
                  ];

                  const numberStyle = [
                    styles.dayNumber,
                    isTodayLive ? styles.dayNumberToday : null,
                    numberColor ? { color: numberColor } : null,
                    numberColor === '#000000' ? styles.dayNumberOutlineOnLight : null,
                    numberColor === '#FFFFFF' ? styles.dayNumberOutlineOnDark : null,
                  ];

                  const content = (
                    <>
                      <BodyText style={numberStyle}>{day}</BodyText>
                      {isTodayLive && <View style={styles.todayLiveTick} />}
                    </>
                  );

                  if (!record) {
                    return (
                      <View key={dayIndex} style={tileStyle}>
                        {content}
                      </View>
                    );
                  }

                  return (
                    <PressableOpacity
                      key={dayIndex}
                      style={tileStyle}
                      onPress={() => router.push({ pathname: '/day-detail', params: { dateKey } })}
                    >
                      {content}
                    </PressableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <Label style={styles.footerNote}>Color fill = that day&apos;s color · green/red ring = pass/fail</Label>
        </Panel>
      </ScrollView>
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
  title: {
    fontSize: typeScale.specimen,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // Layout only — the surface fill/border/radius come from Panel.
  streakPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.signal,
  },
  streakNumber: {
    fontSize: typeScale.display,
  },
  chainRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chainTile: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chainTilePass: {
    backgroundColor: colors.positive,
    borderColor: colors.positive,
  },
  chainTileFail: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  chainTileLive: {
    borderColor: colors.signal,
    borderWidth: 1.5,
  },
  // Layout only — the surface fill/border/radius come from Panel.
  calendarPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  month: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.value,
  },
  weekRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  daysGrid: {
    gap: spacing.xs,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Every played day is a filled tile in that day's actual target color
  // (background set inline); untracked days keep just this hairline
  // outline. Consistent rounded-tile shape for the whole grid, whether
  // played or not.
  dayTile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // Pass/fail is a restrained ring around the tile, not the fill itself
  // — the fill is always that day's real color.
  dayTilePass: {
    borderColor: colors.positive,
    borderWidth: 1.5,
  },
  dayTileFail: {
    borderColor: colors.signal,
    borderWidth: 1.5,
  },
  dayNumber: {
    fontSize: typeScale.value,
    color: colors.textMuted,
  },
  dayNumberToday: {
    fontFamily: fonts.primarySemiBold,
    color: colors.textPrimary,
  },
  // A soft halo in the opposite tone behind the number, so it stays
  // legible even on a mid-tone fill (bright yellow-greens etc.) where a
  // flat black-or-white text color alone can still be hard to read.
  dayNumberOutlineOnLight: {
    textShadowColor: 'rgba(255, 255, 255, 0.35)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  dayNumberOutlineOnDark: {
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Today, unplayed — a small red tick, echoing the countdown "live dot".
  todayLiveTick: {
    width: 6,
    height: 2,
    backgroundColor: colors.signal,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
