import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../../components/BodyText';
import { FlameIcon } from '../../components/FlameIcon';
import { FriendThumbnails } from '../../components/FriendThumbnails';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StatusDot } from '../../components/StatusDot';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { fetchFriends, fetchIncomingRequests } from '../../lib/friends';
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
  const { user, isLoaded: isAuthLoaded } = useAuth();
  const userId = user?.id ?? null;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hasFriends, setHasFriends] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} {...swipeHandlers}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerText}>
          <HeroText style={styles.title}>Friends</HeroText>
        </View>
        {userId ? (
          <PressableOpacity style={styles.manageButton} onPress={() => router.push('/friends/manage')}>
            <Ionicons name="person-add-outline" size={20} color={colors.textMuted} />
            {pendingRequestCount > 0 && <View style={styles.manageBadge} />}
          </PressableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {!isAuthLoaded ? null : !userId ? (
        <View style={styles.signedOutBody}>
          <Panel style={styles.panel}>
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
          contentContainerStyle={styles.scrollContent}
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
            <Panel style={styles.panel}>
              <BodyText style={styles.error}>{"Couldn't load the leaderboard."}</BodyText>
              <PrimaryButton label="Try Again" onPress={refresh} />
            </Panel>
          )}

          {leaderboard.length > 0 && (
            <Panel style={styles.panel}>
              {leaderboard.map((entry, index) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  rank={index + 1}
                  isYou={entry.userId === userId}
                  onOpenPhoto={openPhoto}
                />
              ))}
            </Panel>
          )}

          {!hasFriends && (
            <Panel style={styles.panel}>
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

// "73% · Pass", "41% · Fail", or "Not yet".
function todayStatusLabel(entry: LeaderboardEntry): string {
  if (!entry.playedToday) return 'Not yet';
  return `${entry.todayAverage}% · ${entry.passedToday ? 'Pass' : 'Fail'}`;
}

// A small row pairing the score/status text with a color-coded pass/fail
// dot (the same StatusDot used on Today's completed strip and day-detail),
// so results are scannable at a glance instead of relying on the word
// "Pass"/"Fail" alone. Renders no dot for someone who hasn't played yet.
function TodayStatus({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={styles.statusRow}>
      <Label>{todayStatusLabel(entry)}</Label>
      {entry.playedToday && <StatusDot passed={entry.passedToday} />}
    </View>
  );
}

// One row shape for every rank — geometry is identical across the whole
// list (fixed-width rank column, fixed-width medal bar, flexed identity,
// fixed streak column), so nothing shifts horizontally between rows. The
// signed-in user's own row gets a background fill only, never a border
// or radius change, so it stays box-identical to every other row.
type RowProps = { entry: LeaderboardEntry; isYou: boolean; onOpenPhoto: (entry: LeaderboardEntry, index: number) => void };

// The 1/2/3 medal tints — same colors.medalGold/Silver/Bronze values as
// before, now applied to both the rank number and the dedicated medal
// bar column below (rank 4+ gets neither).
const RANK_TINT: Record<number, string> = {
  1: colors.medalGold,
  2: colors.medalSilver,
  3: colors.medalBronze,
};

function LeaderboardRow({ entry, rank, isYou, onOpenPhoto }: RowProps & { rank: number }) {
  const medalColor = RANK_TINT[rank];
  return (
    <View style={[styles.row, isYou && styles.youTint]}>
      <View style={styles.rankColumn}>
        <Label style={[styles.rank, medalColor ? { color: medalColor } : null]}>{rank}</Label>
      </View>
      <View style={[styles.medalBar, medalColor ? { backgroundColor: medalColor } : null]} />
      <View style={styles.identity}>
        <BodyText style={styles.name}>{isYou ? 'You' : entry.displayName}</BodyText>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  // Same size as Progress/Settings' titles — this is a tab root, not a
  // sub-screen, and should read with the same weight as its peers.
  title: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 32,
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
  // One shape for every row, rank 1 included — same paddingHorizontal,
  // same border, same minHeight regardless of content, so nothing shifts
  // horizontally or vertically between rows. minHeight matches
  // FriendThumbnails' 56pt squares so a row without thumbnails (hasn't
  // played today) still reserves the same height as one with them.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rankColumn: {
    width: 32,
    alignItems: 'center',
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
  // Marks the signed-in user's own row so they can find themselves
  // instantly — a background fill only, nothing that would change the
  // row's box (no border, no radius), so it stays identical in shape to
  // every other row.
  youTint: {
    backgroundColor: colors.secondarySurface,
  },
});
