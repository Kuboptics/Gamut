import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { HeroText } from '../../components/HeroText';
import { IntroModal } from '../../components/IntroModal';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { motionDuration, motionEasing } from '../../constants/motion';
import { useAuth } from '../../context/AuthContext';
import { useReminder } from '../../context/ReminderContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTabSwipe } from '../../hooks/useTabSwipe';
import { ensureProfile, updateDisplayName } from '../../lib/friends';

const MAX_DISPLAY_NAME_LENGTH = 40;

// Formats an hour/minute pair as "6:30 PM" — same 12-hour, no-leading-
// zero style a clock face would use.
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

// The four core rules, in order, plus a fifth "how scoring works" note
// kept visually separate below by spacing alone. No emojis — plain
// typographic hierarchy, like an instrument manual.
const HOW_IT_WORKS = [
  {
    title: 'Daily Color',
    body: 'A unique color drops each day, waiting to be found in the real world.',
  },
  {
    title: 'Snap Photos',
    body: 'Submit three photos, each containing the color.',
  },
  {
    title: 'Get Scored',
    body: 'Each photo is scored on how closely it matches the target. The average of all three decides the round.',
  },
  {
    title: 'Build a Streak',
    body: 'Playing any day — pass or fail — grows your streak. Miss a day and it resets.',
  },
];

// A daily local reminder to play, with a system-picked time. Everything
// here is on-device (expo-notifications, scheduled locally) — no
// accounts, no server, matching the rest of the app's Phase 2 features.
export default function SettingsScreen() {
  const { enabled, hour, minute, isLoaded, permissionDenied, setEnabled, setTime } = useReminder();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const router = useRouter();
  const { user, isLoaded: isAuthLoaded, signOut } = useAuth();

  const [showIntro, setShowIntro] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState('');
  // The last name actually persisted — the yardstick for "has this been
  // edited?" (isNameDirty below) and what the field reverts to showing
  // once a save lands.
  const [savedName, setSavedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  const userId = user?.id;
  const userEmail = user?.email;

  // Seeds the field with the current name (creating a profile with a
  // sensible default if this account somehow doesn't have one yet — e.g.
  // it signed up before display names existed, or before Friends was ever
  // opened). Never overwrites anything the user is actively typing.
  const refreshProfile = useCallback(() => {
    if (!userId) return;
    const fallbackName = userEmail?.split('@')[0] ?? 'Player';
    setProfileLoadError(false);
    ensureProfile(userId, fallbackName)
      .then((profile) => {
        setDisplayNameInput(profile.displayName);
        setSavedName(profile.displayName);
      })
      .catch(() => setProfileLoadError(true));
  }, [userId, userEmail]);

  useFocusEffect(refreshProfile);

  const trimmedNameInput = displayNameInput.trim();
  // Drives the Save button's fade — true only once the field actually
  // differs from what's saved, never just because it's focused. An empty
  // field can never be "dirty", so Save can't appear for a blank name.
  const isNameDirty = trimmedNameInput.length > 0 && trimmedNameInput !== savedName;

  async function handleSaveName() {
    if (!user || isSavingName || !isNameDirty) return;
    const trimmed = trimmedNameInput;
    setIsSavingName(true);
    setNameError(null);
    try {
      await updateDisplayName(user.id, trimmed);
      setSavedName(trimmed);
      setDisplayNameInput(trimmed);
      nameInputRef.current?.blur();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Couldn't save that name — try again.");
    } finally {
      setIsSavingName(false);
    }
  }

  // The picker component wants a Date, but only its hour/minute matter
  // — the rest of the date is thrown away as soon as it changes.
  const timeAsDate = useMemo(() => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }, [hour, minute]);

  function handleTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !date) return;
    setTime(date.getHours(), date.getMinutes());
  }

  // The Save button is always mounted beside the field — only its
  // opacity animates — so it never resizes the row or shifts the input
  // beside it the way the old label-swapping button did.
  const reducedMotion = useReducedMotion();
  const saveButtonOpacity = useSharedValue(0);
  useEffect(() => {
    const target = isNameDirty ? 1 : 0;
    saveButtonOpacity.value = reducedMotion
      ? target
      : withTiming(target, { duration: motionDuration.base, easing: motionEasing });
  }, [isNameDirty, reducedMotion, saveButtonOpacity]);
  const saveButtonAnimatedStyle = useAnimatedStyle(() => ({ opacity: saveButtonOpacity.value }));

  const swipeHandlers = useTabSwipe(3);

  return (
    <SafeAreaView style={styles.container} {...swipeHandlers}>
      <View style={styles.header}>
        <HeroText style={styles.title}>Settings</HeroText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Panel style={styles.body}>
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              {/* A small red "active" dot — one of this screen's signal
                  touches — only shows once the reminder is actually on,
                  echoing the countdown/live-day dot elsewhere. */}
              {enabled && <View style={styles.liveDot} />}
              <BodyText style={styles.rowLabel}>Daily Reminder</BodyText>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              disabled={!isLoaded}
              trackColor={{ false: colors.border, true: colors.textPrimary }}
              thumbColor={colors.background}
              ios_backgroundColor={colors.border}
            />
          </View>

          {permissionDenied && (
            <Label style={styles.note}>Notifications are off in system settings — enable them to use this</Label>
          )}

          {enabled && (
            <View style={styles.timeZone}>
              <Label>Reminder Time</Label>

              {Platform.OS === 'android' ? (
                <>
                  <PressableOpacity onPress={() => setShowAndroidPicker(true)}>
                    <BodyText style={styles.timeValue}>{formatTime(hour, minute)}</BodyText>
                  </PressableOpacity>
                  {showAndroidPicker && (
                    <DateTimePicker value={timeAsDate} mode="time" display="default" onChange={handleTimeChange} />
                  )}
                </>
              ) : (
                <>
                  <BodyText style={styles.timeValue}>{formatTime(hour, minute)}</BodyText>
                  <DateTimePicker
                    value={timeAsDate}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    onChange={handleTimeChange}
                    style={styles.picker}
                  />
                </>
              )}
            </View>
          )}
        </Panel>

        {isAuthLoaded && (
          <Panel style={styles.accountPanel}>
            <Label>Account</Label>

            {user ? (
              <>
                <BodyText style={styles.rowLabel}>{user.email}</BodyText>

                {profileLoadError && (
                  <>
                    <BodyText style={styles.error}>{"Couldn't load your profile."}</BodyText>
                    <PrimaryButton label="Try Again" onPress={refreshProfile} />
                  </>
                )}

                <TextField
                  ref={nameInputRef}
                  label="Display Name"
                  value={displayNameInput}
                  onChangeText={(text) => {
                    setDisplayNameInput(text);
                    setNameError(null);
                  }}
                  onSubmitEditing={handleSaveName}
                  placeholder="Player"
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  autoComplete="name"
                  textContentType="name"
                  accessory={
                    <Animated.View style={saveButtonAnimatedStyle} pointerEvents={isNameDirty ? 'auto' : 'none'}>
                      <ActionButton label="Save" tone="neutral" onPress={handleSaveName} />
                    </Animated.View>
                  }
                />
                {nameError && <BodyText style={styles.error}>{nameError}</BodyText>}

                <View style={styles.authButtonRow}>
                  <ActionButton label="Sign Out" tone="signal" onPress={() => signOut()} />
                </View>
              </>
            ) : (
              <>
                <BodyText style={styles.note}>
                  Sign in to get ready for friends and leaderboards — the game itself never requires it.
                </BodyText>
                <PrimaryButton label="Create Account" onPress={() => router.push('/sign-up')} />
                <View style={styles.authButtonRow}>
                  <ActionButton label="Sign In" tone="neutral" onPress={() => router.push('/sign-in')} />
                </View>
              </>
            )}
          </Panel>
        )}

        <Panel style={styles.howItWorksPanel}>
          <View style={styles.howItWorksHeader}>
            <Label>How It Works</Label>
            <PressableOpacity onPress={() => setShowIntro(true)}>
              <BodyText style={styles.link}>View Intro Again</BodyText>
            </PressableOpacity>
          </View>

          {HOW_IT_WORKS.map((section) => (
            <View key={section.title} style={styles.sectionRow}>
              <BodyText style={styles.sectionTitle}>{section.title}</BodyText>
              <BodyText style={styles.sectionBody}>{section.body}</BodyText>
              {section.title === 'Get Scored' && (
                <View style={styles.scoreLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotPass]} />
                    <Label>60%+ passes</Label>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotFail]} />
                    <Label>Below 60% fails</Label>
                  </View>
                </View>
              )}
            </View>
          ))}

          <View style={styles.sectionRow}>
            <BodyText style={styles.sectionTitle}>How Scoring Works</BodyText>
            <BodyText style={styles.sectionBody}>
              Each photo is analyzed in Lab color space — the space human vision is modeled on — and compared to
              the target color region by region. The best-matching area sets your score.
            </BodyText>
          </View>
        </Panel>
      </ScrollView>

      <IntroModal visible={showIntro} onClose={() => setShowIntro(false)} />
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
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // Layout only — the surface fill/border/radius now come from Panel.
  body: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.signal,
  },
  // A row title, not a small caption, so it's a plain-case Inter
  // BodyText rather than the small tracked-uppercase Label style.
  rowLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  note: {
    color: colors.textMuted,
  },
  timeZone: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  // A clock reading, not a hex code/score/the drop countdown, so it's
  // outside the narrowed dot-matrix rule — Inter (BodyText) instead.
  timeValue: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
  },
  picker: {
    height: 160,
    width: '100%',
  },
  // Layout only — the surface fill/border/radius come from Panel.
  accountPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  link: {
    ...fonts.primary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Keeps Sign Out/Sign In compact and centered, like the other row-level
  // ActionButtons on this screen, instead of stretching full-width the
  // way PrimaryButton does.
  authButtonRow: {
    alignItems: 'center',
  },
  error: {
    color: colors.signal,
  },
  // Layout only — the surface fill/border/radius come from Panel.
  howItWorksPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionRow: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  sectionBody: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  scoreLegendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: radius.sm,
  },
  legendDotPass: {
    backgroundColor: colors.positive,
  },
  legendDotFail: {
    backgroundColor: colors.signal,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  footerNote: {
    textAlign: 'center',
  },
});
