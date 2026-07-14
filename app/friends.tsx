import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { BodyText } from '../components/BodyText';
import { HeroText } from '../components/HeroText';
import { Label } from '../components/Label';
import { Panel } from '../components/Panel';
import { PressableOpacity } from '../components/PressableOpacity';
import { PrimaryButton } from '../components/PrimaryButton';
import { ReadoutText } from '../components/ReadoutText';
import { TextField } from '../components/TextField';
import { colors, fonts, radius, spacing, typeScale } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  ensureProfile,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  respondToRequest,
  sendFriendRequest,
  type Friend,
  type IncomingRequest,
  type OutgoingRequest,
} from '../lib/friends';
import { fetchLeaderboard, type LeaderboardEntry } from '../lib/leaderboard';

// Friend codes + mutual-accept requests, display names, and a friends
// leaderboard/feed built from synced round_results. Reachable only from
// Settings' Account panel while signed in.
export default function FriendsScreen() {
  const { user } = useAuth();
  const userId = user!.id; // this screen is only ever reachable while signed in

  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [codeInput, setCodeInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const email = user?.email;
  const refresh = useCallback(() => {
    const fallbackName = email?.split('@')[0] ?? 'Player';
    setLoadError(false);

    ensureProfile(userId, fallbackName)
      .then((profile) => setMyCode(profile.friendCode))
      .catch(() => setLoadError(true));

    fetchIncomingRequests(userId).then(setIncoming).catch(() => setLoadError(true));
    fetchOutgoingRequests(userId).then(setOutgoing).catch(() => setLoadError(true));

    fetchFriends(userId)
      .then((friendList) => {
        setFriends(friendList);
        return fetchLeaderboard(
          userId,
          friendList.map((friend) => friend.userId)
        );
      })
      .then((entries) => setLeaderboard(entries.slice().sort((a, b) => b.streak - a.streak)))
      .catch(() => setLoadError(true));
  }, [userId, email]);

  // Refetches every time this screen gains focus — e.g. coming back to it
  // after accepting a request or playing today's round — not just once
  // on first mount.
  useFocusEffect(refresh);

  async function handleCopyCode() {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendRequest() {
    if (isSending) return;
    setSendError(null);
    setSendSuccess(false);
    setIsSending(true);
    try {
      const result = await sendFriendRequest(userId, codeInput);
      if (result.ok) {
        setCodeInput('');
        setSendSuccess(true);
        refresh();
      } else {
        setSendError(result.message);
      }
    } catch {
      setSendError("Couldn't send that request — try again.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleRespond(requestId: string, status: 'accepted' | 'declined') {
    try {
      await respondToRequest(requestId, status);
      refresh();
    } catch {
      // Non-fatal: the request just stays pending; the user can try again.
    }
  }

  const feed = leaderboard.filter((entry) => entry.userId !== userId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <HeroText style={styles.title}>Friends</HeroText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loadError && (
          <Panel style={styles.panel}>
            <BodyText style={styles.error}>{"Couldn't load your friends data."}</BodyText>
            <PrimaryButton label="Try Again" onPress={refresh} />
          </Panel>
        )}

        <Panel style={styles.panel}>
          <Label>Your Code</Label>
          {myCode ? (
            <>
              <ReadoutText style={styles.code}>{myCode}</ReadoutText>
              <ActionButton label={copied ? 'Copied' : 'Copy Code'} tone="neutral" onPress={handleCopyCode} />
            </>
          ) : (
            <BodyText style={styles.note}>Loading your code…</BodyText>
          )}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Add a Friend</Label>
          <TextField
            label="Their Code"
            value={codeInput}
            onChangeText={(text) => {
              setCodeInput(text);
              setSendError(null);
              setSendSuccess(false);
            }}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {sendError && <BodyText style={styles.error}>{sendError}</BodyText>}
          {sendSuccess && <BodyText style={styles.success}>Request sent.</BodyText>}
          <PrimaryButton
            label={isSending ? 'Sending…' : 'Send Request'}
            onPress={handleSendRequest}
            style={isSending ? styles.buttonDisabled : undefined}
          />
        </Panel>

        <Panel style={styles.panel}>
          <View style={styles.sectionHeader}>
            <Label>Requests</Label>
            {incoming.length > 0 && (
              <View style={styles.countBadge}>
                <BodyText style={styles.countBadgeText}>{incoming.length}</BodyText>
              </View>
            )}
          </View>
          {incoming.length === 0 ? (
            <BodyText style={styles.note}>No pending requests.</BodyText>
          ) : (
            incoming.map((request) => (
              <View key={request.id} style={styles.row}>
                <BodyText style={styles.rowLabel}>{request.senderDisplayName}</BodyText>
                <View style={styles.rowActions}>
                  <ActionButton label="Decline" tone="signal" onPress={() => handleRespond(request.id, 'declined')} />
                  <ActionButton label="Accept" tone="positive" onPress={() => handleRespond(request.id, 'accepted')} />
                </View>
              </View>
            ))
          )}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Sent Requests</Label>
          {outgoing.length === 0 ? (
            <BodyText style={styles.note}>No pending sent requests.</BodyText>
          ) : (
            outgoing.map((request) => (
              <View key={request.id} style={styles.row}>
                <BodyText style={styles.rowLabel}>{request.receiverDisplayName}</BodyText>
                <Label>Pending</Label>
              </View>
            ))
          )}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Friends</Label>
          {friends.length === 0 ? (
            <BodyText style={styles.note}>No friends yet — share your code to add one.</BodyText>
          ) : (
            friends.map((friend) => (
              <View key={friend.id} style={styles.row}>
                <BodyText style={styles.rowLabel}>{friend.displayName}</BodyText>
              </View>
            ))
          )}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Leaderboard</Label>
          {leaderboard.map((entry, index) => (
            <View key={entry.userId} style={styles.row}>
              <View style={styles.rowLabelGroup}>
                <Label style={styles.rank}>{index + 1}</Label>
                <BodyText style={styles.rowLabel}>{entry.userId === userId ? 'You' : entry.displayName}</BodyText>
              </View>
              <View style={styles.rowLabelGroup}>
                <BodyText style={styles.streakValue}>{entry.streak}</BodyText>
                <StatusDot entry={entry} />
              </View>
            </View>
          ))}
        </Panel>

        <Panel style={styles.panel}>
          <Label>Feed</Label>
          {friends.length === 0 ? (
            <BodyText style={styles.note}>Add a friend to see their progress here.</BodyText>
          ) : (
            feed.map((entry) => (
              <View key={entry.userId} style={styles.row}>
                <BodyText style={styles.rowLabel}>{entry.displayName}</BodyText>
                <View style={styles.rowLabelGroup}>
                  <BodyText style={styles.streakValue}>{entry.streak}</BodyText>
                  <StatusDot entry={entry} />
                </View>
              </View>
            ))
          )}
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

type ActionButtonTone = 'positive' | 'signal' | 'neutral';

const TONE_COLOR: Record<ActionButtonTone, string> = {
  positive: colors.positive,
  signal: colors.signal,
  neutral: colors.textPrimary,
};

// A small, obviously-tappable bordered button for row-level actions
// (Copy Code, Accept, Decline) — deliberately not `PrimaryButton` (that's
// reserved for one full-width main action per screen) and deliberately
// not plain tappable text, which is the exact confusion this replaces.
function ActionButton({ label, tone, onPress }: { label: string; tone: ActionButtonTone; onPress: () => void }) {
  const toneColor = TONE_COLOR[tone];
  const style: StyleProp<ViewStyle> = [styles.actionButton, { borderColor: toneColor }];
  return (
    <PressableOpacity style={style} onPress={onPress}>
      <BodyText style={[styles.actionButtonLabel, { color: toneColor }]}>{label}</BodyText>
    </PressableOpacity>
  );
}

// Green if passed today, red if played but failed, muted if not played
// yet — the same pass/fail dot language as app/day-detail.tsx, with one
// added neutral state.
function StatusDot({ entry }: { entry: LeaderboardEntry }) {
  const style = !entry.playedToday ? styles.statusDotPending : entry.passedToday ? styles.statusDotPass : styles.statusDotFail;
  return <View style={[styles.statusDot, style]} />;
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typeScale.value,
  },
  headerSpacer: {
    width: 32,
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
  code: {
    fontSize: typeScale.specimen,
  },
  note: {
    color: colors.textMuted,
  },
  error: {
    color: colors.signal,
  },
  success: {
    color: colors.positive,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontFamily: fonts.primarySemiBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  rank: {
    width: 16,
  },
  streakValue: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.button,
    fontVariant: ['tabular-nums'],
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionButtonLabel: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
  },
  statusDotPass: {
    backgroundColor: colors.positive,
  },
  statusDotFail: {
    backgroundColor: colors.signal,
  },
  statusDotPending: {
    backgroundColor: colors.textMuted,
  },
});
