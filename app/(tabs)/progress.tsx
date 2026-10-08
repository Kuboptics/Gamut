import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/AppHeader';
import { BodyText } from '../../components/BodyText';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { TickRule } from '../../components/TickRule';
import { fonts, radius, spacing, TAB_BAR_CLEARANCE, typeScale, type ThemeColors } from '../../constants/theme';
import { useHistory, type DayRecord } from '../../context/HistoryContext';
import { useStreak } from '../../context/StreakContext';
import { useThemedStyles } from '../../context/ThemeContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { contrastTextColor } from '../../lib/color';
import { getDailyTarget } from '../../lib/dailyColor';

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

// The small day numbers sit in tight ~40pt tiles, so they may grow a
// little with the iPhone's text-size setting, but not so much that they
// burst out of the grid.
const TILE_NUMBER_MAX_FONT_SCALE = 1.2;

// A check for a passed day, a cross for a failed one. The shape (not a
// red-vs-green color) carries the result, so it reads the same for
// red-green color-blind players. Colored black or white, whichever
// contrasts best with that day's fill.
function OutcomeMark({ record, size }: { record: DayRecord; size: number }) {
  return (
    <Ionicons
      name={record.outcome === 'passed' ? 'checkmark' : 'close'}
      size={size}
      color={contrastTextColor(record.hex)}
    />
  );
}

// A row of small tiles, one per of the last 7 days (today included).
// A played day is filled with that day's own target color, with a
// check (pass) or cross (fail) inside. A missed day stays an empty
// outline, and today keeps a small red outline while it's still
// unplayed. Pulled straight from HistoryContext, so it's never out of
// sync with the calendar below it. (The row ends on today, so it never
// contains a future day.)
function StreakChain({ history }: { history: Record<string, DayRecord> }) {
  const styles = useThemedStyles(makeStyles);
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
              record ? { backgroundColor: record.hex } : null,
              !record && isToday && styles.chainTileLive,
            ]}
          >
            {record && <OutcomeMark record={record} size={16} />}
          </View>
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
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { currentStreak, isLoaded: streakLoaded } = useStreak();
  const { history } = useHistory();
  const isActive = streakLoaded && currentStreak > 0;
  const todayHue = getDailyTarget().hue;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const weeks = getMonthGrid(today);
  const todayDateKey = dateKeyFor(year, month, today.getDate());
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const swipeHandlers = useTabSwipe(1);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']} {...swipeHandlers}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxl + insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <Panel style={styles.streakPanel} hue={todayHue}>
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

        <Panel style={styles.calendarPanel} hue={todayHue}>
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
                  // Same "YYYY-MM-DD" shape on both sides, so a plain
                  // string comparison sorts by date.
                  const isFuture = dateKey > todayDateKey;
                  const numberColor = record ? contrastTextColor(record.hex) : null;

                  const tileStyle = [
                    styles.dayTile,
                    record ? { backgroundColor: record.hex } : null,
                    isFuture ? styles.dayTileFuture : null,
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
                      <BodyText style={numberStyle} maxFontSizeMultiplier={TILE_NUMBER_MAX_FONT_SCALE}>
                        {day}
                      </BodyText>
                      {isTodayLive && <View style={styles.todayLiveTick} />}
                      {record && (
                        <View style={styles.dayMark}>
                          <OutcomeMark record={record} size={11} />
                        </View>
                      )}
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
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  chainRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // The hairline border stays on played tiles too, so a pale day color
  // still has a visible edge against the light theme's background.
  chainTile: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
    ...fonts.primarySemiBold,
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
  // Days still to come: the same empty outline as a missed day, but
  // faded, so "hasn't happened yet" never reads as "missed".
  dayTileFuture: {
    opacity: 0.4,
  },
  // Pass/fail is a small check or cross pinned to the tile's top-right
  // corner, not the fill itself — the fill is always that day's real
  // color, and the day number keeps the center.
  dayMark: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  dayNumber: {
    fontSize: typeScale.value,
    color: colors.textMuted,
  },
  dayNumberToday: {
    ...fonts.primarySemiBold,
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
});
