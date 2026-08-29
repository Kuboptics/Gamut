import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BackButton } from '../../components/BackButton';
import { BodyText } from '../../components/BodyText';
import { DiamondIcon } from '../../components/DiamondIcon';
import { FlameIcon } from '../../components/FlameIcon';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { MedalIcon } from '../../components/MedalIcon';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { ReadoutText } from '../../components/ReadoutText';
import { StatusDot } from '../../components/StatusDot';
import { motionDuration, motionEasing } from '../../constants/motion';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { PASS_THRESHOLD } from '../../context/RoundContext';
import { blockUser, removeFriend } from '../../lib/friends';
import { fetchFriendHistory, type FriendDay, type FriendHistory } from '../../lib/friendProfile';

// Parses a "YYYY-MM-DD" key back into a local-time Date — same helper as
// app/day-detail.tsx (building the Date from its parts, not
// `new Date(dateKey)`, avoids a timezone shift landing on the wrong
// calendar day). Small enough that duplicating it here beats pulling it
// into a shared module for one extra caller.
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// A compact "Jul 25" form (no year) for the summary card's Best Day
// column label — short month, unlike formatDateLabel's full
// "July 25, 2026", so "Best Day · Jul 25" fits one column's width.
function formatMonthDayLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The four score-based tiers the summary card's medal badge shows,
// keyed to the overall-average value (not to leaderboard rank — see
// colors.medalGold/Silver/Bronze in constants/theme.ts, which mark
// leaderboard *position* and are a deliberately different, separate
// palette from these). `icon` is just this semantic tag, not a specific
// glyph name — see TierIcon below for which family/name each renders as.
// `min` doubles as both the threshold medalForAverage checks against and
// the number TierKeyModal's interval text below is written around — one
// list, so the four cutoffs can't drift out of sync between the badge
// and the key.
type MedalTier = { label: string; interval: string; color: string; icon: 'diamond' | 'medal'; min: number };

// Ordered highest cutoff first — medalForAverage below relies on that
// order to find the first (i.e. highest) tier an average qualifies for.
const MEDAL_TIERS: MedalTier[] = [
  { label: 'Diamond', interval: '70% and above', color: '#5CD5E0', icon: 'diamond', min: 70 },
  { label: 'Gold', interval: '60–69%', color: '#E0A24E', icon: 'medal', min: 60 },
  { label: 'Silver', interval: '50–59%', color: '#B8BEC6', icon: 'medal', min: 50 },
  { label: 'Bronze', interval: 'Below 50%', color: '#C77B4A', icon: 'medal', min: 0 },
];

function medalForAverage(average: number): MedalTier {
  return MEDAL_TIERS.find((tier) => average >= tier.min) ?? MEDAL_TIERS[MEDAL_TIERS.length - 1];
}

// Renders the right glyph for a tier — DiamondIcon/MedalIcon are local
// react-native-svg components built from Tabler Icons' outline SVGs
// (see their own files for the source/license note), not an
// @expo/vector-icons font glyph. Flame stays Ionicons/FlameIcon
// unchanged; only these two moved to Tabler.
function TierIcon({ icon, size, color }: { icon: MedalTier['icon']; size: number; color: string }) {
  if (icon === 'diamond') return <DiamondIcon size={size} color={color} />;
  return <MedalIcon size={size} color={color} />;
}

// Read-only history for one player — every day they've played, newest
// first. Reused for both a friend's row and your own row on the Friends
// leaderboard (see app/(tabs)/friends.tsx) — fetchFriendHistory takes
// any user id, so the only thing that differs for "your own" case is
// which controls show below. Nothing here writes to round_results;
// there's no submit path on this screen.
export default function FriendProfileScreen() {
  // requestId is the friend_requests row id for this player (see
  // lib/friends.ts's removeFriend) — passed through by the leaderboard's
  // tap handler when it has one. It's absent when viewing your own row
  // (you're never your own friend_requests row) or, harmlessly, if the
  // friends list was momentarily out of sync when the tap fired — either
  // way, no requestId just means the header's remove control can't do
  // anything, so it stays hidden (see the header's trailing slot below).
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isOwnProfile = id === user?.id;

  // null = still loading. One combined object now that the summary strip
  // needs streak/average/best alongside days — all four arrive from the
  // same fetch and are only ever used together, unlike the header title
  // (displayName), which used to be tracked separately for no real reason.
  const [history, setHistory] = useState<FriendHistory | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Refetches every time this screen gains focus — matches the same
  // useFocusEffect(refresh) pattern app/(tabs)/friends.tsx and
  // app/friends/manage.tsx already use, rather than a one-shot load, so
  // new photos/scores/streak/average always show up on return (e.g. after
  // a friend plays while you're elsewhere in the app, or after your own
  // Submit). On the very first focus `history` is still null, so the
  // full-screen spinner below shows; on every focus after that, the old
  // data stays on screen (no spinner, no flash to empty) until the fresh
  // fetch resolves and silently replaces it — the same "just refetch and
  // swap in the result" behavior the Friends tab's own refresh already
  // has, with no separate "refreshing" indicator of its own.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoadError(false);
      fetchFriendHistory(id)
        .then((result) => {
          if (!cancelled) setHistory(result);
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const displayName = history?.displayName ?? '';
  const days = history?.days ?? null;

  // Reuses lib/friends.ts's removeFriend — same confirmation copy as the
  // leaderboard's long-press and app/friends/manage.tsx's Remove button,
  // just triggered from here instead. On success, navigating back to the
  // Friends tab is enough to refresh it: that screen already refetches on
  // every focus (see its useFocusEffect(refresh)), so there's no need for
  // a second refresh mechanism here.
  function handleRemove() {
    if (!requestId) return;
    Alert.alert(`Remove ${displayName}?`, "You'll need to add each other again to reconnect.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoveError(null);
          try {
            await removeFriend(requestId);
            router.back();
          } catch {
            setRemoveError("Couldn't remove that friend — try again.");
          }
        },
      },
    ]);
  }

  // Blocking is heavier than removing — it also ends the friendship (see
  // lib/friends.ts's blockUser) — so it gets its own confirmation with
  // both consequences spelled out, same copy as app/friends/manage.tsx's
  // block confirmation, rather than folding straight into the ⋯ menu's
  // own "Block" choice above.
  function handleBlock() {
    if (!requestId || !user) return;
    Alert.alert(
      `Block ${displayName}?`,
      "They won't be able to see your photos or add you again. This also removes them as a friend.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setRemoveError(null);
            try {
              await blockUser(user.id, id, displayName, requestId);
              router.back();
            } catch {
              setRemoveError("Couldn't block that user — try again.");
            }
          },
        },
      ]
    );
  }

  // The header's ⋯ control — was a direct shortcut to handleRemove, now
  // a small menu since there are two destructive choices to offer.
  function handleManage() {
    Alert.alert(displayName, undefined, [
      { text: 'Remove friend', style: 'destructive', onPress: handleRemove },
      { text: 'Block', style: 'destructive', onPress: handleBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <HeroText style={styles.title} numberOfLines={1}>
            {displayName}
          </HeroText>
        </View>
        {/* Trailing slot, scoped to this screen's own header row (not the
            shared AppHeader — that component has no trailing slot and
            only renders on the tab-root screens). Only ever the Remove/
            Block menu, and only for a friend's profile — see
            isOwnProfile/requestId below. Same fixed 32x32 box as the
            plain spacer it replaces, so the title stays centered either
            way. */}
        {!isOwnProfile && requestId ? (
          <PressableOpacity style={styles.headerAction} hitSlop={8} onPress={handleManage}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </PressableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {removeError && <BodyText style={styles.removeErrorText}>{removeError}</BodyText>}

      {loadError ? (
        <View style={styles.centerBody}>
          <Panel style={styles.messagePanel}>
            <BodyText style={styles.error}>{"Couldn't load this friend's history."}</BodyText>
          </Panel>
        </View>
      ) : days === null ? (
        <View style={styles.centerBody}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      ) : days.length === 0 ? (
        <View style={styles.centerBody}>
          <Panel style={styles.messagePanel}>
            <Label>No rounds yet</Label>
          </Panel>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {history && <SummaryCard history={history} isOwnProfile={isOwnProfile} />}
          {days.map((day) => (
            <DayPanel key={day.dateKey} day={day} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// The profile's one summary card. Top section: overall average as the
// hero (left half, plain white — pass-green stays reserved for the best
// day below) beside a medal badge keyed to that same average (right
// half). A hairline, then a bottom row: best day (small swatch + green
// score + date) and streak (flame) side by side. Renders nothing when
// there's no best day — i.e. no days at all — since the screen's own
// empty state (days.length === 0) already covers that case with its own
// "No rounds yet" panel; this is just a defensive match for
// FriendHistory's `best`/`average` types being nullable. No hue tint on
// the card itself (unlike DayPanel below), since it spans every day
// rather than belonging to one.
function SummaryCard({ history, isOwnProfile }: { history: FriendHistory; isOwnProfile: boolean }) {
  // Hooks must run before any early return below (Rules of Hooks) — this
  // is the only state this card needs, and it's fully local to here: the
  // modal's open/closed-ness has no bearing on anything outside this
  // component.
  const [tierModalVisible, setTierModalVisible] = useState(false);

  if (!history.best || history.average === null) return null;
  const tier = medalForAverage(history.average);

  return (
    <Panel style={styles.summaryCard}>
      <View style={styles.topSection}>
        <View style={styles.heroColumn}>
          <Label>Overall Average</Label>
          <HeroText style={styles.heroValue}>{history.average}%</HeroText>
          <Label>Across Every Shot</Label>
        </View>
        <View style={styles.topDivider} />
        {/* Tappable: opens the tier key below. Press feedback comes from
            PressableOpacity's usual dim/scale; the small info glyph
            corner-anchored in this cell's top-right is the second, static
            hint that this cell (unlike heroColumn beside it) does
            something when tapped — the whole cell is still the tap
            target, not just the glyph itself. */}
        <PressableOpacity style={styles.medalColumn} onPress={() => setTierModalVisible(true)}>
          <Ionicons
            name="information-circle-outline"
            size={12}
            color={colors.textMuted}
            style={styles.medalInfoIcon}
          />
          {/* 36 (up from 28) — this badge is the card's one focal medal/
              diamond moment, so it reads more prominent than the same
              glyph reused compactly in each TierKeyModal row below
              (still 22 there — left alone; a matching bump there
              crowded the two-line text next to it in a plain list row,
              where the summary badge has a whole cell to itself). */}
          <TierIcon icon={tier.icon} size={36} color={tier.color} />
          <Label style={{ color: tier.color }}>{tier.label}</Label>
        </PressableOpacity>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.summaryBottomRow}>
        <View style={styles.summaryColumn}>
          <View style={styles.bestDayRow}>
            <View style={[styles.bestDaySwatch, { backgroundColor: history.best.hex }]} />
            <HeroText style={styles.bestDayValue}>{history.best.average}%</HeroText>
          </View>
          <Label>Best Day · {formatMonthDayLabel(history.best.dateKey)}</Label>
        </View>
        <View style={styles.summaryColumnDivider} />
        <View style={styles.summaryColumn}>
          <View style={styles.streakRow}>
            <FlameIcon size={20} />
            <HeroText style={styles.streakValue}>{history.streak}</HeroText>
          </View>
          <Label>Day Streak</Label>
        </View>
      </View>

      {/* Modal renders in its own native layer regardless of where it
          sits in this JSX tree — placed last here just for readability. */}
      <TierKeyModal
        visible={tierModalVisible}
        onClose={() => setTierModalVisible(false)}
        currentTier={tier}
        isOwnProfile={isOwnProfile}
      />
    </Panel>
  );
}

type TierKeyModalProps = {
  visible: boolean;
  onClose: () => void;
  currentTier: MedalTier;
  // Gates the "You" marker below — without this, the marker just found
  // whichever row matched `currentTier` regardless of whose profile that
  // was, mislabeling a friend's tier as "You" on a friend's profile. See
  // FriendProfileScreen's own isOwnProfile (id === user?.id) — this is
  // that same value, threaded down through SummaryCard.
  isOwnProfile: boolean;
};

// The tier key — opened by tapping the medal badge above. Same dismiss
// shape as components/IntroModal.tsx, this app's only other simple
// (non-photo-viewer) modal: a Reanimated fade-in backdrop, a tap-anywhere-
// on-the-backdrop-to-close Pressable behind the card, plus an explicit
// close (×) control in the card's own header — two ways to dismiss, as
// asked for. Kept as one plain `visible` boolean owned by SummaryCard
// above; nothing about this modal's state is shared with the rest of the
// screen.
function TierKeyModal({ visible, onClose, currentTier, isOwnProfile }: TierKeyModalProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(motionDuration.base).easing(motionEasing)} style={styles.tierModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Panel style={styles.tierModalCard}>
          <View style={styles.tierModalHeader}>
            <HeroText style={styles.tierModalTitle}>Tiers</HeroText>
            <PressableOpacity style={styles.tierModalClose} hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </PressableOpacity>
          </View>

          {MEDAL_TIERS.map((tier) => {
            const isCurrent = isOwnProfile && tier.label === currentTier.label;
            return (
              <View key={tier.label} style={[styles.tierRow, isCurrent && styles.tierRowCurrent]}>
                <TierIcon icon={tier.icon} size={22} color={tier.color} />
                <View style={styles.tierRowText}>
                  <BodyText style={styles.tierRowLabel}>{tier.label}</BodyText>
                  <Label>{tier.interval}</Label>
                </View>
                {isCurrent && <Label style={styles.tierYou}>You</Label>}
              </View>
            );
          })}
        </Panel>
      </Animated.View>
    </Modal>
  );
}

// One day's round, shown fully inline (no tap-to-expand for v1). Tinted
// with that day's own hue via Panel — same pattern day-detail.tsx uses
// for a past day's record, not today's live target hue.
function DayPanel({ day }: { day: FriendDay }) {
  const passed = day.outcome === 'passed';
  const verdictStyle = passed ? styles.pass : styles.fail;

  return (
    <Panel style={styles.dayPanel} hue={day.hue}>
      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <BodyText style={styles.dateLabel}>{formatDateLabel(day.dateKey)}</BodyText>
          <Label>
            {day.colorName} · {day.hex}
          </Label>
        </View>
        <View style={styles.averageBlock}>
          <ReadoutText style={[styles.average, verdictStyle]}>{day.average}%</ReadoutText>
          <Label style={verdictStyle}>{passed ? 'Pass' : 'Fail'}</Label>
        </View>
      </View>

      <View style={styles.scoreList}>
        {day.scores.map((score, index) => (
          <View key={index} style={styles.scoreRow}>
            <Label>Shot {index + 1}</Label>
            <View style={styles.scoreRowRight}>
              <BodyText style={styles.scoreValue}>{score}%</BodyText>
              <StatusDot passed={score >= PASS_THRESHOLD} />
            </View>
          </View>
        ))}
      </View>
    </Panel>
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
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: typeScale.value,
  },
  // Balances the BackButton on the left so the title stays visually
  // centered — same trick as app/day-detail.tsx's header. Rendered in
  // place of headerAction below whenever there's no remove control to
  // show (your own profile, or a friend row with no requestId), so the
  // header's width is identical either way.
  headerSpacer: {
    width: 32,
  },
  // Same fixed 32x32 box as BackButton and headerSpacer, so nothing
  // shifts when this replaces the plain spacer for a friend's profile.
  headerAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagePanel: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  error: {
    color: colors.signal,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // No hue prop, unlike dayPanel below — this spans every day, not one.
  summaryCard: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  // gap (not per-side padding) puts even breathing room on both sides of
  // topDivider regardless of which half is narrower.
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Left-aligned — same established left edge the rest of the card uses,
  // unlike medalColumn beside it, which the brief calls out as centered.
  heroColumn: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  // The hero number itself: HeroText's own base color (colors.textPrimary,
  // i.e. plain white) is left untouched here — no color override — since
  // pass-green is reserved for the best-day score below.
  heroValue: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  // Faint vertical hairline splitting the top section in two — same
  // color as every other divider in this card (colors.border).
  topDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  // position: relative so medalInfoIcon below can anchor to this cell's
  // own corner rather than the card's. paddingTop pushes the icon+label
  // stack down from the box's top edge — medalInfoIcon (top: 0, absolute)
  // stays pinned to that edge regardless, so this is what actually keeps
  // clearance between the corner glyph and the (now-larger, size 36)
  // medal/diamond icon beneath it, rather than the two overlapping.
  medalColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    position: 'relative',
    paddingTop: spacing.sm,
  },
  medalInfoIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  // Same shape as components/IntroModal.tsx's backdrop — centered card
  // over a dimmed scrim, tappable anywhere to close.
  tierModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.xl,
  },
  tierModalCard: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  tierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tierModalTitle: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
  },
  tierModalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // The player's own current tier — a subtle fill, same restrained
  // treatment the leaderboard's own rank-1 row uses (border/background
  // tint, no shadow/elevation), just neutral here rather than gold since
  // this is "your position", not a rank medal.
  tierRowCurrent: {
    backgroundColor: colors.secondarySurface,
    borderTopColor: 'transparent',
  },
  tierRowText: {
    flex: 1,
    gap: spacing.xs,
  },
  tierRowLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  tierYou: {
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  // gap (not per-column padding) puts even breathing room on both sides
  // of summaryColumnDivider regardless of which column is narrower.
  summaryBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // flex-start so every line in a column — number and label alike —
  // starts at that column's own left edge, same axis the hero above uses.
  summaryColumn: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  summaryColumnDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  bestDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Small, unlike the old hero-sized swatch this card used to have — a
  // secondary column badge now, alongside the streak column's flame, not
  // the card's main specimen. Real game color content (like ColorSwatch
  // elsewhere), not Panel's muted day-tint chrome.
  bestDaySwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bestDayValue: {
    fontSize: typeScale.value,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    color: colors.positive,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakValue: {
    fontSize: typeScale.value,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  // Layout only — surface fill/border/radius come from Panel, tinted per
  // day via its hue prop.
  dayPanel: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dayHeaderLeft: {
    gap: spacing.xs,
  },
  dateLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  averageBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  average: {
    fontSize: typeScale.value,
  },
  pass: {
    color: colors.positive,
  },
  fail: {
    color: colors.signal,
  },
  scoreList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scoreRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreValue: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.value,
    fontVariant: ['tabular-nums'],
  },
  // Shown right under the header when a remove attempt (triggered from
  // the header's trailing control) fails — same destructive red as every
  // other error text in the app (colors.signal).
  removeErrorText: {
    ...fonts.primary,
    fontSize: typeScale.button,
    color: colors.signal,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
