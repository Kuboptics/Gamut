import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/AppHeader';
import { BodyText } from '../../components/BodyText';
import { FlameIcon } from '../../components/FlameIcon';
import { FriendThumbnails } from '../../components/FriendThumbnails';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, fonts, radius, spacing, TAB_BAR_CLEARANCE, typeScale } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { getDailyTarget } from '../../lib/dailyColor';
import { fetchFriends, fetchIncomingRequests, removeFriend, type Friend } from '../../lib/friends';
import { fetchLeaderboard, rankLeaderboard, type LeaderboardEntry } from '../../lib/leaderboard';

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

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']} {...swipeHandlers}>
      <AppHeader />
      {userId && (
        <View style={styles.manageRow}>
          <PressableOpacity style={styles.manageButton} onPress={() => router.push('/friends/manage')}>
            <Ionicons name="person-add-outline" size={20} color={colors.textMuted} />
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
                    onRemove={!isYou && matchedFriend ? () => handleRemoveFriend(matchedFriend) : undefined}
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
  // Undefined on your own row (can't unfriend yourself) — see the
  // leaderboard.map above. When present, tapping the friend's name opens
  // the same remove confirmation app/friends/manage.tsx uses.
  onRemove?: () => void;
};

// The 1/2/3 medal tints — same colors.medalGold/Silver/Bronze values as
// before, now applied to both the rank number and the dedicated medal
// bar column below (rank 4+ gets neither).
const RANK_TINT: Record<number, string> = {
  1: colors.medalGold,
  2: colors.medalSilver,
  3: colors.medalBronze,
};

function LeaderboardRow({ entry, rank, isYou, onOpenPhoto, onRemove }: RowProps & { rank: number }) {
  const medalColor = RANK_TINT[rank];
  const name = isYou ? 'You' : entry.displayName;
  return (
    <View style={[styles.row, rank === 1 && styles.rowRankOne]}>
      <View style={styles.rankColumn}>
        <Label style={[styles.rank, medalColor ? { color: medalColor } : null]}>{rank}</Label>
      </View>
      <View style={[styles.medalBar, medalColor ? { backgroundColor: medalColor } : null]} />
      <View style={styles.identity}>
        {onRemove ? (
          <PressableOpacity onPress={onRemove}>
            <BodyText style={styles.name}>{name}</BodyText>
          </PressableOpacity>
        ) : (
          <BodyText style={styles.name}>{name}</BodyText>
        )}
        <TodayStatus entry={entry} />
        {entry.playedToday && (
          <FriendThumbnails
            urls={entry.thumbnailUrls}
            style={styles.thumbnails}
            onPressPhoto={(index) => onOpenPhoto(entry, index)}
          />
        )}
      </View>
      <View style={styles.streakGroup}>
        <BodyText style={styles.streakValue}>{entry.streak}</BodyText>
        <FlameIcon size={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Just the manage-friends affordance now that the screen title is gone
  // (the shared header above the tabs covers that) — right-aligned, its
  // own small row rather than a full header bar.
  manageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  manageButton: {
    width: 32,
    height: 32,
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
    paddingVertical: spacing.sm,
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
  name: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  thumbnails: {
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  streakValue: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
    fontVariant: ['tabular-nums'],
  },
});
