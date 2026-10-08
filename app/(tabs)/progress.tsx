import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/AppHeader';
import { BodyText } from '../../components/BodyText';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { FlameIcon } from '../../components/FlameIcon';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { fonts, radius, spacing, TAB_BAR_CLEARANCE, typeScale, type ThemeColors } from '../../constants/theme';
import { useHistory, type DayRecord } from '../../context/HistoryContext';
import { useStreak } from '../../context/StreakContext';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { contrastTextColor } from '../../lib/color';
import {
  BADGE_THRESHOLDS,
  CYCLE_DAYS,
  badgeForPoints,
  cycleInfo,
  cyclePoints,
  cycleRangeFor,
  type Badge,
} from '../../lib/cycle';
import { getDailyTarget } from '../../lib/dailyColor';
import {
  BADGE_LADDER,
  BADGE_NAMES,
  BADGES_SECTION_TITLE,
  CROWN_SECTION_TITLE,
  formatPoints,
  POINTS_EXPLAINER_SECTIONS,
  POINTS_EXPLAINER_TITLE,
  STREAK_SECTION_TITLE,
} from '../../lib/pointsExplainer';
import { todayKey } from '../../lib/streak';

// The grid shows the cycle's 30 days as 5 rows of 6.
const GRID_COLUMNS = 6;

// The small day numbers sit in tight tiles, so they may grow a little
// with the iPhone's text-size setting, but not so much that they burst
// out of the grid. The big points number uses the same cap.
const TILE_NUMBER_MAX_FONT_SCALE = 1.2;

// The crown and flame in front of the "How points work" headings.
const EXPLAINER_ICON_SIZE = 15;

// Each badge's dot uses the same theme color as the badge gem on the
// friend profile (constants/theme.ts), in dark and light mode.
const BADGE_COLOR_TOKENS: Record<Badge, 'tierBronze' | 'tierSilver' | 'tierGold' | 'tierDiamond'> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  diamond: 'tierDiamond',
};
const BADGE_DOT_SIZE = 10;
const BADGE_DOT_GAP = spacing.xs;

// The badge ladder split into rows of two for the 2x2 grid, in reading
// order: [Bronze, Silver], [Gold, Diamond].
const BADGE_GRID_COLUMNS = 2;
const BADGE_GRID_ROWS = Array.from({ length: Math.ceil(BADGE_LADDER.length / BADGE_GRID_COLUMNS) }, (_, rowIndex) =>
  BADGE_LADDER.slice(rowIndex * BADGE_GRID_COLUMNS, (rowIndex + 1) * BADGE_GRID_COLUMNS)
);

// The badge thresholds lowest first (lib/cycle.ts lists them highest
// first), so "the next badge" is simply the first one not reached yet.
const THRESHOLDS_ASCENDING = BADGE_THRESHOLDS.slice().reverse();

// "29 days left", "1 day left", "0 days left".
function daysLeftText(daysLeft: number): string {
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
}

// The date key `days` after `startKey`. Counted in UTC, like
// lib/cycle.ts, so a daylight-saving change can never skip or repeat a
// day.
function addDaysToKey(startKey: string, days: number): string {
  const [year, month, day] = startKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// A day's average, the same rule the app uses when it saves a day to
// the cloud (lib/historySync.ts): the rounded mean of its shot scores.
function dayAverage(record: DayRecord): number {
  if (record.scores.length === 0) return 0;
  return Math.round(record.scores.reduce((sum, score) => sum + score, 0) / record.scores.length);
}

// Progress toward the next badge: how far through the current band the
// points are (from the last badge reached, or 0, up to the next one).
// Null once Diamond is reached: there's nothing further to aim for.
function nextBadgeProgress(points: number): { badge: Badge; pointsToGo: number; fraction: number } | null {
  const next = THRESHOLDS_ASCENDING.find((threshold) => points < threshold.minPoints);
  if (!next) return null;
  const previous = THRESHOLDS_ASCENDING.filter((threshold) => threshold.minPoints <= points).pop();
  const bandStart = previous?.minPoints ?? 0;
  return {
    badge: next.badge,
    pointsToGo: next.minPoints - points,
    fraction: (points - bandStart) / (next.minPoints - bandStart),
  };
}

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

// The "Progress" screen, built around the current 30-day cycle: the
// cycle's points and badge progress at the top, then one tile per day of
// the cycle, then the streak. Only cycle day numbers (1-30) are shown,
// never real dates or month names.
export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { currentStreak, isLoaded: streakLoaded } = useStreak();
  const { history, isLoaded: historyLoaded } = useHistory();
  const todayHue = getDailyTarget().hue;
  const swipeHandlers = useTabSwipe(1);
  const { colors } = useTheme();

  const today = todayKey();
  const { cycleNumber, daysLeft } = cycleInfo(today);
  const { startKey } = cycleRangeFor(cycleNumber);
  const cycleDateKeys = Array.from({ length: CYCLE_DAYS }, (_, index) => addDaysToKey(startKey, index));

  // The same points the friends leaderboard shows, computed from this
  // device's own history instead of from the cloud.
  const rows = Object.entries(history).map(([dateKey, record]) => ({ date_key: dateKey, average: dayAverage(record) }));
  const points = cyclePoints(rows, cycleNumber);
  const badge = badgeForPoints(points);
  const next = nextBadgeProgress(points);

  // Splits the 30 days into rows of 6.
  const gridRows = Array.from({ length: CYCLE_DAYS / GRID_COLUMNS }, (_, rowIndex) =>
    cycleDateKeys.slice(rowIndex * GRID_COLUMNS, (rowIndex + 1) * GRID_COLUMNS)
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']} {...swipeHandlers}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxl + insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <Panel style={styles.pointsPanel} hue={todayHue}>
          <View style={styles.titleRow}>
            <Label>Cycle {cycleNumber}</Label>
            <Label>{daysLeft === 0 ? 'Last day' : daysLeftText(daysLeft)}</Label>
          </View>

          {!historyLoaded ? (
            <Label>Loading…</Label>
          ) : (
            <>
              <HeroText
                style={styles.pointsNumber}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={TILE_NUMBER_MAX_FONT_SCALE}
              >
                {formatPoints(points)}
              </HeroText>
              <Label style={styles.pointsCaption}>Cycle points</Label>
              <BodyText style={styles.badgeLine}>{badge ? `${BADGE_NAMES[badge]} so far` : 'No badge yet'}</BodyText>

              <View
                style={styles.badgeProgress}
                accessible
                accessibilityLabel={
                  next ? `${formatPoints(next.pointsToGo)} points to ${BADGE_NAMES[next.badge]}` : 'Diamond reached'
                }
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round((next?.fraction ?? 1) * 100)}%` }]} />
                </View>
                <Label>
                  {next ? `${formatPoints(next.pointsToGo)} to ${BADGE_NAMES[next.badge]}` : 'Diamond reached'}
                </Label>
              </View>
            </>
          )}
        </Panel>

        <Panel style={styles.gridPanel} hue={todayHue}>
          <View style={styles.grid}>
            {gridRows.map((rowKeys, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {rowKeys.map((dateKey, columnIndex) => {
                  const dayNumber = rowIndex * GRID_COLUMNS + columnIndex + 1;
                  const record = history[dateKey];
                  const isTodayLive = dateKey === today && !record;
                  // Same "YYYY-MM-DD" shape on both sides, so a plain
                  // string comparison sorts by date.
                  const isFuture = dateKey > today;
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
                        {dayNumber}
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
                      <View key={dateKey} style={tileStyle}>
                        {content}
                      </View>
                    );
                  }

                  return (
                    <PressableOpacity
                      key={dateKey}
                      style={tileStyle}
                      accessibilityLabel={`Day ${dayNumber}, ${record.outcome === 'passed' ? 'passed' : 'failed'}`}
                      onPress={() => router.push({ pathname: '/day-detail', params: { dateKey } })}
                    >
                      {content}
                    </PressableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {streakLoaded && (
            <Label style={styles.streakLine}>
              {currentStreak} played {currentStreak === 1 ? 'day' : 'days'} in a row
            </Label>
          )}
        </Panel>

        {/* A quiet reference card at the very bottom, closed until tapped.
            The copy lives in lib/pointsExplainer.ts so Settings can reuse it. */}
        <CollapsibleCard title={POINTS_EXPLAINER_TITLE}>
          {POINTS_EXPLAINER_SECTIONS.map((section) => (
            <View key={section.title} style={styles.explainerSection}>
              {/* Crown and Streak get their leaderboard icon in front of
                  the heading; every other heading is text only. */}
              <View style={styles.explainerHeadingRow}>
                {section.title === CROWN_SECTION_TITLE && (
                  <MaterialCommunityIcons name="crown" size={EXPLAINER_ICON_SIZE} color={colors.medalGold} />
                )}
                {section.title === STREAK_SECTION_TITLE && <FlameIcon size={EXPLAINER_ICON_SIZE} />}
                <BodyText style={styles.explainerHeading}>{section.title}</BodyText>
              </View>
              <BodyText style={styles.explainerBody}>{section.body}</BodyText>

              {/* The badge ladder as a 2x2 grid, read row by row: Bronze
                  and Silver, then Gold and Diamond. Built as two rows
                  (not two columns) so VoiceOver reads it in that same
                  order; each row's own divider piece lines up with the
                  next to form one unbroken line down the middle. */}
              {section.title === BADGES_SECTION_TITLE && (
                <View style={styles.badgeGrid}>
                  {BADGE_GRID_ROWS.map((row) => (
                    <View key={row[0].badge} style={styles.badgeGridRow}>
                      {row.map((rung, columnIndex) => (
                        <Fragment key={rung.badge}>
                          {columnIndex > 0 && <View style={styles.badgeGridDivider} />}
                          <View
                            style={[
                              styles.badgeGridCell,
                              columnIndex === 0 ? styles.badgeGridCellLeft : styles.badgeGridCellRight,
                            ]}
                          >
                            <View style={styles.badgeNameRow}>
                              <View style={[styles.badgeDot, { backgroundColor: colors[BADGE_COLOR_TOKENS[rung.badge]] }]} />
                              <BodyText style={styles.badgeLadderName} maxFontSizeMultiplier={TILE_NUMBER_MAX_FONT_SCALE}>
                                {rung.name}
                              </BodyText>
                            </View>
                            <BodyText style={styles.badgeLadderThreshold} maxFontSizeMultiplier={TILE_NUMBER_MAX_FONT_SCALE}>
                              {rung.threshold}
                            </BodyText>
                          </View>
                        </Fragment>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </CollapsibleCard>
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
  pointsPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  // "CYCLE N" pinned left, days left pinned right, same layout as the
  // Friends leaderboard header.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointsNumber: {
    fontSize: typeScale.display,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  // Layout only: the text style comes from Label, like every other caption
  // here. The negative margin cancels the card's gap, because the big
  // number already has empty space below its digits, so the caption sits
  // snugly under it instead of making the card taller.
  pointsCaption: {
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  badgeLine: {
    ...fonts.primarySemiBold,
    textAlign: 'center',
  },
  badgeProgress: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // A thin bar: a faint full-width track, with the filled part in the
  // primary text color on top.
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.textPrimary,
  },
  // Layout only — the surface fill/border/radius come from Panel.
  gridPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  grid: {
    gap: spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  // Every played day is a filled tile in that day's actual target color
  // (background set inline); other days keep just this hairline outline.
  // Same rounded-tile shape for the whole grid, whether played or not.
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
  streakLine: {
    textAlign: 'center',
  },
  // A heading, with room for an icon in front of it.
  explainerHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // The 2x2 badge grid under the Badges text. No gap between the two rows,
  // so the divider pieces join into one line; the cells' own vertical
  // padding spaces the rows instead.
  badgeGrid: {
    marginTop: spacing.xs,
  },
  // stretch makes the divider piece as tall as the row.
  badgeGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  // Two equal columns.
  badgeGridCell: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  // The same padding on both sides of the divider. The left column's
  // outer edge lines up with the text above it.
  badgeGridCellLeft: {
    paddingRight: spacing.md,
  },
  badgeGridCellRight: {
    paddingLeft: spacing.md,
  },
  // A hairline in the app's usual divider color (the same one the
  // leaderboard rows use between them).
  badgeGridDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  // The dot and the badge name side by side, centered on each other.
  badgeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BADGE_DOT_GAP,
  },
  // A small filled circle in the badge's own color (set inline).
  badgeDot: {
    width: BADGE_DOT_SIZE,
    height: BADGE_DOT_SIZE,
    borderRadius: BADGE_DOT_SIZE / 2,
  },
  badgeLadderName: {
    color: colors.textPrimary,
  },
  // Directly under the name, left aligned with it: indented by the dot
  // and its gap, so it starts where the name starts.
  badgeLadderThreshold: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginLeft: BADGE_DOT_SIZE + BADGE_DOT_GAP,
  },
  explainerSection: {
    gap: spacing.xs,
  },
  // Each heading in the primary text color, semibold like the badge line.
  explainerHeading: {
    ...fonts.primarySemiBold,
  },
  // Each body in the muted text color, BodyText's normal size and font.
  explainerBody: {
    color: colors.textMuted,
  },
});
