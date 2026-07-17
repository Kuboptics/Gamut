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

  const [leader, ...rest] = leaderboard;
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

          {leader && <LeaderRow entry={leader} isYou={leader.userId === userId} onOpenPhoto={openPhoto} />}

          {rest.length > 0 && (
            <Panel style={styles.panel}>
              {rest.map((entry, index) => (
                <RankRow
                  key={entry.userId}
                  entry={entry}
                  rank={index + 2}
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

// Rank 1 gets its own panel and visual weight — a signal-red accent
// border, the streak in HeroText with a larger flame, rather than just
// being the top row of a plain list. Still just one accent color, no
// trophy/gradient. The signed-in user's own row (whether or not they're
// #1) additionally gets a background tint so it's instantly findable.
type RowProps = { entry: LeaderboardEntry; isYou: boolean; onOpenPhoto: (entry: LeaderboardEntry, index: number) => void };

function LeaderRow({ entry, isYou, onOpenPhoto }: RowProps) {
  return (
    <Panel style={[styles.leaderPanel, isYou && styles.youTint]}>
      <View style={styles.leaderRow}>
        <View style={styles.leaderIdentity}>
          <Label style={styles.leaderRank}>1</Label>
          <View>
            <BodyText style={styles.leaderName}>{isYou ? 'You' : entry.displayName}</BodyText>
            <Label>{todayStatusLabel(entry)}</Label>
            {entry.playedToday && (
              <FriendThumbnails
                urls={entry.thumbnailUrls}
                style={styles.thumbnails}
                onPressPhoto={(index) => onOpenPhoto(entry, index)}
              />
            )}
          </View>
        </View>
        <View style={styles.streakGroup}>
          <HeroText style={styles.leaderStreak}>{entry.streak}</HeroText>
          <FlameIcon size={28} />
        </View>
      </View>
    </Panel>
  );
}

function RankRow({ entry, rank, isYou, onOpenPhoto }: RowProps & { rank: number }) {
  return (
    <View style={[styles.row, isYou && styles.youTint]}>
      <View style={styles.rowIdentity}>
        <Label style={styles.rank}>{rank}</Label>
        <View>
          <BodyText style={styles.rowLabel}>{isYou ? 'You' : entry.displayName}</BodyText>
          <Label>{todayStatusLabel(entry)}</Label>
          {entry.playedToday && (
            <FriendThumbnails
              urls={entry.thumbnailUrls}
              style={styles.thumbnails}
              onPressPhoto={(index) => onOpenPhoto(entry, index)}
            />
          )}
        </View>
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
  // The one deliberate accent on the whole screen — a signal-red left
  // border marking the #1 spot, not a fill/gradient.
  leaderPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  leaderRank: {
    color: colors.signal,
    width: 20,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  leaderName: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.value,
  },
  thumbnails: {
    marginTop: spacing.sm,
  },
  streakGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leaderStreak: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  rank: {
    width: 16,
    fontVariant: ['tabular-nums'],
  },
  streakValue: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
    fontVariant: ['tabular-nums'],
  },
  // Marks the signed-in user's own row so they can find themselves
  // instantly — composes with the leader panel's border accent above
  // without conflicting (a tint plus a border, not two competing colors).
  youTint: {
    backgroundColor: colors.secondarySurface,
    borderRadius: radius.sm,
  },
});
