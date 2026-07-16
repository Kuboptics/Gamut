import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Share, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../../components/ActionButton';
import { BackButton } from '../../components/BackButton';
import { BodyText } from '../../components/BodyText';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ReadoutText } from '../../components/ReadoutText';
import { TextField } from '../../components/TextField';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
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
} from '../../lib/friends';

// Friend codes, requests, and connections — everything that manages who
// you're friends with, tucked behind the icon button on the Friends tab
// (app/(tabs)/friends.tsx) rather than competing with the leaderboard
// for attention. Reachable only while signed in.
export default function ManageFriendsScreen() {
  const { user } = useAuth();
  const userId = user!.id;

  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
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
    fetchFriends(userId).then(setFriends).catch(() => setLoadError(true));
  }, [userId, email]);

  useFocusEffect(refresh);

  async function handleCopyCode() {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareCode() {
    if (!myCode) return;
    try {
      await Share.share({ message: `Add me on Gamut — my friend code is ${myCode}` });
    } catch {
      // User cancelled the share sheet or it failed; nothing to recover.
    }
  }

  async function handleSendRequest() {
    if (isSending) return;
    Haptics.selectionAsync().catch(() => {});
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
    if (status === 'accepted') Haptics.selectionAsync().catch(() => {});
    try {
      await respondToRequest(requestId, status);
      refresh();
    } catch {
      // Non-fatal: the request just stays pending; the user can try again.
    }
  }

  const hasAnyRequests = incoming.length > 0 || outgoing.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <HeroText style={styles.title}>Manage Friends</HeroText>
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
              <View style={styles.buttonRow}>
                <ActionButton label={copied ? 'Copied' : 'Copy'} tone="neutral" onPress={handleCopyCode} />
                <ActionButton label="Share" tone="neutral" onPress={handleShareCode} />
              </View>
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
            {incoming.length > 0 && <View style={styles.countBadge} />}
          </View>

          {!hasAnyRequests ? (
            <BodyText style={styles.note}>No pending requests.</BodyText>
          ) : (
            <>
              {incoming.length > 0 && (
                <View style={styles.requestGroup}>
                  <Label style={styles.subLabel}>Incoming</Label>
                  {incoming.map((request) => (
                    <View key={request.id} style={styles.row}>
                      <BodyText style={styles.rowLabel}>{request.senderDisplayName}</BodyText>
                      <View style={styles.rowActions}>
                        <ActionButton
                          label="Decline"
                          tone="signal"
                          onPress={() => handleRespond(request.id, 'declined')}
                        />
                        <ActionButton
                          label="Accept"
                          tone="positive"
                          filled
                          onPress={() => handleRespond(request.id, 'accepted')}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {outgoing.length > 0 && (
                <View style={styles.requestGroup}>
                  <Label style={styles.subLabel}>Sent</Label>
                  {outgoing.map((request) => (
                    <View key={request.id} style={styles.row}>
                      <BodyText style={styles.rowLabel}>{request.receiverDisplayName}</BodyText>
                      <Label>Pending</Label>
                    </View>
                  ))}
                </View>
              )}
            </>
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // A small alert dot — the same restrained signal every other pending/
  // live indicator in the app uses (the header's own manageBadge, the
  // countdown/reminder live dots) — not a heavier filled count pill.
  countBadge: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.signal,
  },
  // Groups Incoming/Sent within the one merged Requests panel — a small
  // sub-label rather than a whole separate boxed section.
  requestGroup: {
    gap: spacing.xs,
  },
  subLabel: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
