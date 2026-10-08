import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/AppHeader';
import { BodyText } from '../../components/BodyText';
import { FlameIcon } from '../../components/FlameIcon';
import { FriendThumbnails } from '../../components/FriendThumbnails';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { fonts, radius, spacing, TAB_BAR_CLEARANCE, typeScale, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useThemedStyles } from '../../context/ThemeContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { CYCLE_DAYS, cycleInfo } from '../../lib/cycle';
import { getDailyTarget } from '../../lib/dailyColor';
import { blockUser, fetchFriends, fetchIncomingRequests, removeFriend, type Friend } from '../../lib/friends';
import { fetchLeaderboard, rankLeaderboard, type LeaderboardEntry } from '../../lib/leaderboard';
import { todayKey } from '../../lib/streak';

// The points and streak numbers sit in a narrow right-hand column, so
// they may grow a little with the iPhone's text-size setting, but not
// enough to squeeze the name off the row.
const ROW_NUMBER_MAX_FONT_SCALE = 1.2;

// 2840 -> "2,840". Done by hand rather than with toLocaleString so the
// result never depends on the phone's language or on the JS engine's
// built-in number formatting.
function formatPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "29 days left", "1 day left", or "0 days left" — shared by the visible
// header and its VoiceOver label.
function daysLeftText(daysLeft: number): string {
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
}

// The add-friend button's tap area and the icon drawn inside it.
const MANAGE_BUTTON_SIZE = 32;
const MANAGE_ICON_SIZE = 20;

// The cycle's 30 days are shown as 2 rows of this many circles.
const CYCLE_CIRCLES_PER_ROW = 15;

// The daily target color for each day of the cycle, in order — or null
// for a day that hasn't come yet. Future days are never looked up, so the
// screen can't reveal an upcoming color.
//
// Day arithmetic is done in UTC (like lib/cycle.ts) so daylight saving
// can't skip or repeat a day. getDailyTarget, though, reads a Date's
// *local* year/month/day, so each day is handed to it as a local Date with
// those same three numbers. Noon rather than midnight, because in a few
// time zones a daylight-saving change happens at midnight and that local
// midnight doesn't exist.
function cycleDayColors(startKey: string, dayInCycle: number): (string | null)[] {
  const [year, month, day] = startKey.split('-').map(Number);
  return Array.from({ length: CYCLE_DAYS }, (_, index) => {
    if (index >= dayInCycle) return null;
    const utcDate = new Date(Date.UTC(year, month - 1, day + index));
    const localNoon = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 12);
    return getDailyTarget(localNoon).hex;
  });
}

// The screen's headline, above the leaderboard card: "Cycle N" large,
// with the days left just below it. Read by VoiceOver as one header.
function CycleTitle() {
  const styles = useThemedStyles(makeStyles);
  const { cycleNumber, dayInCycle, daysLeft } = cycleInfo(todayKey());

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Cycle ${cycleNumber}, day ${dayInCycle} of ${CYCLE_DAYS}, ${daysLeftText(daysLeft)}`}
    >
      <HeroText style={styles.cycleTitle} maxFontSizeMultiplier={ROW_NUMBER_MAX_FONT_SCALE}>
        Cycle {cycleNumber}
      </HeroText>
      <BodyText style={styles.cycleDaysLeft} maxFontSizeMultiplier={ROW_NUMBER_MAX_FONT_SCALE}>
        {daysLeft === 0 ? 'Last day' : daysLeftText(daysLeft)}
      </BodyText>
    </View>
  );
}

// The top of the leaderboard card: one circle per day of the cycle,
// 2 rows of 15. Days so far (today included) are filled with that day's
// target color — even days you missed, since this is the cycle's clock,
// not your own record. Today also gets a ring; days still to come are
// empty outlines. Recomputed on every render, so it rolls over at local
// midnight the next time the screen updates. Hidden from VoiceOver —
// CycleTitle above already says where in the cycle we are.
function CycleCircles() {
  const styles = useThemedStyles(makeStyles);
  const { dayInCycle, startKey } = cycleInfo(todayKey());
  // All 30 colors worked out once here (a table lookup each), not in
  // every circle.
  const dayColors = cycleDayColors(startKey, dayInCycle);
  const circleRows = [dayColors.slice(0, CYCLE_CIRCLES_PER_ROW), dayColors.slice(CYCLE_CIRCLES_PER_ROW)];

  return (
    <View style={styles.cycleCircles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {circleRows.map((rowColors, rowIndex) => (
        <View key={rowIndex} style={styles.cycleCircleRow}>
          {rowColors.map((color, columnIndex) => {
            const index = rowIndex * CYCLE_CIRCLES_PER_ROW + columnIndex;
            // The cell decides the size and position; the circle and
            // today's ring are drawn inside it and can't change it.
            return (
              <View key={index} style={styles.cycleCell}>
                <View style={[styles.cycleCircle, color ? { backgroundColor: color } : null]} />
                {index === dayInCycle - 1 && <View style={styles.cycleTodayRing} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// The friends leaderboard — the payoff screen, front and center. Friend
// management (code, requests, add-a-friend) lives behind the icon button
// in the header, on app/friends/manage.tsx, mirroring how Instagram/
// Strava tuck people-management behind the board/feed you actually look
// at day to day. Unlike the rest of the social feature, this is a bottom
// tab — always reachable, so it handles being signed out itself rather
// than assuming Settings already gated entry.
export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoaded: isAuthLoaded } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const userId = user?.id ?? null;
  const todayHue = getDailyTarget().hue;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  // Kept around (not just discarded after building the id list below) so
  // a leaderboard row can be matched back to its friend_requests row id —
  // the leaderboard entries themselves only carry a userId, but removing
  // a friend needs that row id (see lib/friends.ts's removeFriend).
  const [friends, setFriends] = useState<Friend[]>([]);
  const [hasFriends, setHasFriends] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // The one place that actually fetches everything — friends' streaks,
  // today's results, and thumbnails all come from fetchLeaderboard.
  // Returns a promise so callers that need to know when it's *done*
  // (pull-to-refresh's spinner) can await it, while the focus-triggered
  // refresh below just fires it and ignores the result, same as before.
  const loadLeaderboard = useCallback(async () => {
    if (!userId) return;
    setLoadError(false);

    fetchIncomingRequests(userId)
      .then((requests) => setPendingRequestCount(requests.length))
      .catch(() => {});

    try {
      const friendList = await fetchFriends(userId);
      setFriends(friendList);
      setHasFriends(friendList.length > 0);
      const entries = await fetchLeaderboard(
        userId,
        friendList.map((friend) => friend.userId)
      );
      setLeaderboard(rankLeaderboard(entries));
    } catch {
      setLoadError(true);
    }
  }, [userId]);

  const refresh = useCallback(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Refetches every time this tab gains focus — e.g. coming back from
  // Manage after accepting a request, or from playing today's round.
  useFocusEffect(refresh);

  // Also refetch when the app comes back to the foreground while this tab
  // is the one on screen (e.g. you background the app, a friend plays,
  // you switch back). useFocusEffect above only fires on in-app
  // navigation, not on foregrounding, so without this the leaderboard
  // stayed stale until a full close-and-reopen.
  const isFocused = useIsFocused();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocused) refresh();
    });
    return () => subscription.remove();
  }, [refresh, isFocused]);

  // Pull-to-refresh: the same load, but tracked so the spinner shows
  // while it's in flight and disappears once it settles either way.
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadLeaderboard();
    setIsRefreshing(false);
  }, [loadLeaderboard]);

  const swipeHandlers = useTabSwipe(2);

  // Which friend's photo viewer is open, and which of their 3 shots it
  // opened on. Null means closed — see components/PhotoViewerModal.tsx.
  const [viewer, setViewer] = useState<{ entry: LeaderboardEntry; index: number } | null>(null);
  function openPhoto(entry: LeaderboardEntry, index: number) {
    setViewer({ entry, index });
  }

  // Removing a friend is destructive (it ends the friendship for both
  // sides at once — see lib/friends.ts), so it's gated behind the same
  // confirmation app/friends/manage.tsx already uses. A failure here is
  // surfaced via removeError rather than swallowed, for the same reason
  // as manage.tsx: removeFriend throws when the delete didn't actually
  // remove anything (e.g. a missing RLS policy), and a friend silently
  // staying on the leaderboard with no explanation would be worse than
  // no feedback at all.
  function handleRemoveFriend(friend: Friend) {
    Alert.alert(`Remove ${friend.displayName}?`, "You'll need to add each other again to reconnect.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoveError(null);
          try {
            await removeFriend(friend.id);
            refresh();
          } catch {
            setRemoveError("Couldn't remove that friend — try again.");
          }
        },
      },
    ]);
  }

  // Blocking is heavier than removing — it also ends the friendship (see
  // lib/friends.ts's blockUser), so the confirmation spells out both
  // consequences up front rather than just one. Reuses removeError, same
  // as handleRemoveFriend above, rather than a second error state for
  // what's ultimately the same "couldn't act on this friend" case.
  function handleBlockFriend(friend: Friend) {
    if (!userId) return;
    Alert.alert(
      `Block ${friend.displayName}?`,
      "They won't be able to see your photos or add you again. This also removes them as a friend.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setRemoveError(null);
            try {
              await blockUser(userId, friend.userId, friend.displayName, friend.id);
              refresh();
            } catch {
              setRemoveError("Couldn't block that user — try again.");
            }
          },
        },
      ]
    );
  }

  // Long-pressing a friend's name used to jump straight to the remove
  // confirmation; now that there are two destructive choices, it opens
  // this small menu first — same three-choice shape as
  // app/friend/[id].tsx's ⋯ menu.
  function handleFriendMenu(friend: Friend) {
    Alert.alert(friend.displayName, undefined, [
      { text: 'Remove friend', style: 'destructive', onPress: () => handleRemoveFriend(friend) },
      { text: 'Block', style: 'destructive', onPress: () => handleBlockFriend(friend) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']} {...swipeHandlers}>
      <AppHeader />
      {userId && (
        <View style={styles.manageRow}>
          {/* Always present (even when empty) so it keeps the icon button
              pushed to the right edge; the title itself shows only when
              the leaderboard card does. */}
          <View style={styles.titleSlot}>{leaderboard.length > 0 && <CycleTitle />}</View>
          <PressableOpacity style={styles.manageButton} onPress={() => router.push('/friends/manage')}>
            <Ionicons name="person-add-outline" size={MANAGE_ICON_SIZE} color={colors.textMuted} />
            {pendingRequestCount > 0 && <View style={styles.manageBadge} />}
          </PressableOpacity>
        </View>
      )}

      {!isAuthLoaded ? null : !userId ? (
        <View style={[styles.signedOutBody, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
          <Panel style={styles.panel} hue={todayHue}>
            <Label>Friends</Label>
            <BodyText style={styles.note}>
              Sign in to see your friends leaderboard — the game itself never requires it.
            </BodyText>
            <PrimaryButton label="Create Account" onPress={() => router.push('/sign-up')} />
            <PressableOpacity onPress={() => router.push('/sign-in')}>
              <BodyText style={styles.link}>Already have an account? Sign In</BodyText>
            </PressableOpacity>
          </Panel>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xxl + insets.bottom + TAB_BAR_CLEARANCE },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.textPrimary}
              titleColor={colors.textMuted}
              colors={[colors.textPrimary]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {loadError && (
            <Panel style={styles.panel} hue={todayHue}>
              <BodyText style={styles.error}>{"Couldn't load the leaderboard."}</BodyText>
              <PrimaryButton label="Try Again" onPress={refresh} />
            </Panel>
          )}

          {removeError && (
            <Panel style={styles.panel} hue={todayHue}>
              <BodyText style={styles.error}>{removeError}</BodyText>
            </Panel>
          )}

          {leaderboard.length > 0 && (
            <Panel style={styles.panel} hue={todayHue}>
              <CycleCircles />
              {leaderboard.map((entry, index) => {
                const isYou = entry.userId === userId;
                // Only friends (not yourself) can be removed, and only if
                // this entry actually matches a row in `friends` — should
                // always be true for a non-you row, but this stays a safe
                // no-op (undefined onRemove, no tap target) rather than
                // crashing if the two lists were ever out of sync.
                const matchedFriend = friends.find((friend) => friend.userId === entry.userId);
                return (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    rank={index + 1}
                    isYou={isYou}
                    onOpenPhoto={openPhoto}
                    // Opens the same profile screen for your own row too
                    // (fetchFriendHistory takes any user id) — requestId
                    // only ever comes along for a friend's row (see
                    // matchedFriend above; naturally absent for yourself,
                    // since you're never your own friend_requests row),
                    // which is what lets the profile screen show its
                    // remove control only for a friend, never for you.
                    onOpenProfile={() =>
                      router.push({
                        pathname: '/friend/[id]',
                        params: matchedFriend ? { id: entry.userId, requestId: matchedFriend.id } : { id: entry.userId },
                      })
                    }
                    onRemove={!isYou && matchedFriend ? () => handleFriendMenu(matchedFriend) : undefined}
                  />
                );
              })}
            </Panel>
          )}

          {!hasFriends && (
            <Panel style={styles.panel} hue={todayHue}>
              <Label>No Friends Yet</Label>
              <BodyText style={styles.note}>Add a friend to start a leaderboard.</BodyText>
              <PrimaryButton label="Manage Friends" onPress={() => router.push('/friends/manage')} />
            </Panel>
          )}
        </ScrollView>
      )}

      <PhotoViewerModal
        entry={viewer?.entry ?? null}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

// The percentage itself carries the pass/fail color, so a separate dot
// would just be repeating the same signal a second time — the "Pass"/
// "Fail" word stays too, but plain, since the number already colors it.
function TodayStatus({ entry }: { entry: LeaderboardEntry }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!entry.playedToday) {
    return (
      <View style={styles.statusRow}>
        <Label>Not yet</Label>
      </View>
    );
  }
  const scoreColor = entry.passedToday ? colors.positive : colors.signal;
  return (
    <View style={styles.statusRow}>
      <Label style={{ color: scoreColor }}>{entry.todayAverage}%</Label>
      <Label>· {entry.passedToday ? 'Pass' : 'Fail'}</Label>
    </View>
  );
}

// One row shape for every rank — geometry is identical across the whole
// list (fixed-width rank column, fixed-width medal bar, flexed identity,
// fixed streak column), so nothing shifts horizontally between rows. Only
// rank 1 gets a visible border/tint (see styles.rowRankOne) — the
// signed-in user's own row ("You") carries no separate highlight.
type RowProps = {
  entry: LeaderboardEntry;
  isYou: boolean;
  onOpenPhoto: (entry: LeaderboardEntry, index: number) => void;
  // A short tap on any row's name opens that player's full round history
  // (app/friend/[id].tsx) — including your own row, which reuses the same
  // screen. The chevron next to the name is this tap's hint, the
  // conventional "drill in" meaning for a forward chevron.
  onOpenProfile: () => void;
  // Undefined on your own row (can't unfriend/block yourself). When
  // present, long-pressing the same name opens a Remove/Block menu (see
  // handleFriendMenu) — moved off a plain tap so a short tap can mean
  // "view profile" instead without the two gestures colliding.
  onRemove?: () => void;
};

function LeaderboardRow({ entry, rank, isYou, onOpenPhoto, onOpenProfile, onRemove }: RowProps & { rank: number }) {
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The 1/2/3 medal tints — same colors.medalGold/Silver/Bronze values as
  // before (medalGold/Silver/Bronze are deliberately identical in both
  // dark and light — see constants/theme.ts), applied to both the rank
  // number and the dedicated medal bar column below (rank 4+ gets
  // neither). Built per render, not a module-level constant, so this
  // keeps following the theme like every other resolved color here —
  // see ActionButton's own TONE_COLOR for why a module-level version of
  // this would freeze instead.
  const rankTint: Record<number, string> = {
    1: colors.medalGold,
    2: colors.medalSilver,
    3: colors.medalBronze,
  };
  const medalColor = rankTint[rank];
  const name = isYou ? 'You' : entry.displayName;
  return (
    <View style={[styles.row, rank === 1 && styles.rowRankOne, rank === 1 && scheme === 'light' && styles.rowRankOneLight]}>
      <View style={styles.rankColumn}>
        <Label style={[styles.rank, medalColor ? { color: medalColor } : null]}>{rank}</Label>
      </View>
      <View style={[styles.medalBar, medalColor ? { backgroundColor: medalColor } : null]} />
      <View style={styles.identity}>
        {/* Tappable for every row now, including your own (onRemove is
            simply undefined there, so long-press is a no-op) — see
            RowProps.onOpenProfile above. */}
        <PressableOpacity onPress={onOpenProfile} onLongPress={onRemove}>
          <View style={styles.nameRow}>
            <BodyText style={styles.name}>{name}</BodyText>
            {entry.hasCrown && (
              <MaterialCommunityIcons
                name="crown"
                size={14}
                color={colors.medalGold}
                accessible
                accessibilityLabel="Winner of the last cycle"
              />
            )}
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            <TodayStatus entry={entry} />
          </View>
        </PressableOpacity>
        {entry.playedToday && (
          <FriendThumbnails
            urls={entry.thumbnailUrls}
            style={styles.thumbnails}
            onPressPhoto={(index) => onOpenPhoto(entry, index)}
          />
        )}
      </View>
      {/* Cycle points as the big number, with the streak small below it.
          Read out as one phrase by VoiceOver, so the numbers have context. */}
      <View
        style={styles.scoreColumn}
        accessible
        accessibilityLabel={`${formatPoints(entry.cyclePoints)} points, ${entry.streak} day streak`}
      >
        <BodyText style={styles.pointsValue} maxFontSizeMultiplier={ROW_NUMBER_MAX_FONT_SCALE}>
          {formatPoints(entry.cyclePoints)}
        </BodyText>
        <View style={styles.streakGroup}>
          <FlameIcon size={12} dimmed={entry.streak === 0} />
          <BodyText style={styles.streakValue} maxFontSizeMultiplier={ROW_NUMBER_MAX_FONT_SCALE}>
            {entry.streak}
          </BodyText>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // The cycle title on the left, the add-friend button on the right.
  // Same side padding as AppHeader's top bar (spacing.xl), so "Cycle N"
  // starts exactly where the Gamut wordmark does (the button's own
  // negative margin, below, lines its icon up on the right). flex-start
  // keeps the button at the top of the row, level with the title's top,
  // even though the two-line title makes the row taller.
  manageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  // Takes all the space left of the button (and shrinks for it), so a
  // long title can never run under the button.
  titleSlot: {
    flex: 1,
  },
  // Line 1 — the same size and bold system face as the Result screen's
  // "Round Result" title (HeroText, typeScale.specimen).
  cycleTitle: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
  },
  // Line 2 — smaller, in the muted text color, so "Cycle N" leads.
  cycleDaysLeft: {
    fontSize: typeScale.button,
    color: colors.textMuted,
  },
  // The tap area stays 32x32. The 20pt icon sits centered in it, so its
  // visible right edge is (32 - 20) / 2 = 6pt in from the button's edge;
  // the negative right margin moves the whole button 6pt right, so the
  // icon itself (not its invisible tap area) lines up with the right edge
  // of AppHeader's "Next drop" countdown above.
  manageButton: {
    width: MANAGE_BUTTON_SIZE,
    height: MANAGE_BUTTON_SIZE,
    marginRight: -(MANAGE_BUTTON_SIZE - MANAGE_ICON_SIZE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.signal,
  },
  signedOutBody: {
    flex: 1,
    justifyContent: 'center',
  },
  link: {
    ...fonts.primary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  panel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  note: {
    color: colors.textMuted,
  },
  error: {
    color: colors.signal,
  },
  // 2 rows of 15 circles, 4pt apart both across and down.
  cycleCircles: {
    gap: spacing.xs,
  },
  cycleCircleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  // One square cell per day: an equal share of the row, kept square by
  // aspectRatio. It has NO border, padding or margin on purpose — the
  // layout engine counts an item's own border and padding into its
  // starting width, so anything like that here could make one cell wider
  // than the rest. Everything visible is drawn inside it instead.
  cycleCell: {
    flex: 1,
    aspectRatio: 1,
  },
  // The circle itself, filling its cell exactly (absoluteFill), so it can
  // never change the cell's size. The thin muted edge keeps a pale color
  // visible in light mode and a dark one visible in dark mode; on a
  // future day it's the whole (empty) circle.
  cycleCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textMuted,
  },
  // Today's ring, drawn the same way on top of the circle.
  cycleTodayRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  // One shape for every row, rank 1 included — same paddingHorizontal and
  // the same borderWidth/borderRadius, so nothing shifts horizontally
  // between rows. Non-highlighted rows get a transparent border (so the
  // box-model is identical to rank 1's) and a hairline top divider; a row
  // without thumbnails (hasn't played today) simply collapses to its own
  // natural, shorter height rather than being padded out to match one
  // that has them.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // Rank 1 only: a rounded border + very slight background tint, both in
  // the same muted gold as the medal tint — no shadow/elevation, just
  // border + fill. borderTopWidth/Color are overridden here too so all
  // four sides read as one continuous gold rectangle instead of a
  // gold border interrupted by the plain hairline divider.
  rowRankOne: {
    borderColor: colors.medalGold,
    borderTopWidth: 1,
    borderTopColor: colors.medalGold,
    backgroundColor: 'rgba(179, 148, 79, 0.08)',
  },
  // The same 8%-opacity gold reads noticeably fainter on a light row
  // than on a dark one (alpha blending scales with whatever's under
  // it), so light mode uses a higher alpha (0.12) to land at a visually
  // comparable "barely there" tint instead of the mathematically same
  // but visually weaker one. Applied as an override on top of
  // rowRankOne above (unchanged), so dark mode stays byte-for-byte as
  // it was.
  rowRankOneLight: {
    backgroundColor: 'rgba(179, 148, 79, 0.12)',
  },
  rankColumn: {
    width: 32,
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  // Fugaz One (fonts.wordmark) — the same face as the Today wordmark,
  // used here for the rank numeral's display weight. lineHeight is set
  // explicitly because Fugaz's vertical metrics differ from SF's; left
  // to the font's own defaults it renders visibly off-baseline against
  // the row's other (SF) text once centered by `row`'s alignItems.
  rank: {
    ...fonts.wordmark,
    fontSize: typeScale.specimen,
    lineHeight: 32,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  // A real column, not a border — same width on every row so ranks 4+
  // (transparent fill) still occupy the same space as 1/2/3, keeping
  // every column after it aligned.
  medalBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  identity: {
    flex: 1,
  },
  // Name, crown, chevron and today's status on one line. flexWrap lets the
  // status drop to a second line only when the line is too narrow for it
  // (a long name on a small phone); on a normal width it stays on one line.
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // flexShrink lets a long name wrap onto a second line instead of
  // pushing the crown and chevron out of the row on a narrow phone.
  name: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
    flexShrink: 1,
  },
  thumbnails: {
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // The right-hand column: points on top, streak below, both
  // right-aligned. Never shrinks, so the numbers are never cut off — the
  // name column gives way instead.
  scoreColumn: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  // The same style the old big streak number used.
  pointsValue: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
    fontVariant: ['tabular-nums'],
  },
  streakGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakValue: {
    fontSize: 13,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
