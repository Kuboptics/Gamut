import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../../components/BodyText';
import { HeroText } from '../../components/HeroText';
import { Label } from '../../components/Label';
import { Panel } from '../../components/Panel';
import { PressableOpacity } from '../../components/PressableOpacity';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, fonts, radius, spacing, typeScale } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useReminder } from '../../context/ReminderContext';

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
    body: 'Playing — and passing — each day grows your streak. Miss a day and it resets.',
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

  return (
    <SafeAreaView style={styles.container}>
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

          <Label style={styles.note}>Local reminder only — nothing leaves your phone</Label>
        </Panel>

        {isAuthLoaded && (
          <Panel style={styles.accountPanel}>
            <Label>Account</Label>

            {user ? (
              <>
                <BodyText style={styles.rowLabel}>{user.email}</BodyText>
                <PressableOpacity onPress={() => signOut()}>
                  <BodyText style={styles.link}>Sign Out</BodyText>
                </PressableOpacity>
              </>
            ) : (
              <>
                <BodyText style={styles.note}>
                  Sign in to get ready for friends and leaderboards — the game itself never requires it.
                </BodyText>
                <PrimaryButton label="Create Account" onPress={() => router.push('/sign-up')} />
                <PressableOpacity onPress={() => router.push('/sign-in')}>
                  <BodyText style={styles.link}>Already have an account? Sign In</BodyText>
                </PressableOpacity>
              </>
            )}
          </Panel>
        )}

        <Panel style={styles.howItWorksPanel}>
          <Label>How It Works</Label>

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
    fontFamily: fonts.primarySemiBold,
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
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.specimen,
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
    fontFamily: fonts.primary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Layout only — the surface fill/border/radius come from Panel.
  howItWorksPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  sectionRow: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.primarySemiBold,
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
