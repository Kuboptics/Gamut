import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { BodyText } from '../components/BodyText';
import { HeroText } from '../components/HeroText';
import { Panel } from '../components/Panel';
import { PressableOpacity } from '../components/PressableOpacity';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { describeAuthError, isValidEmail } from '../lib/authErrors';
import { ensureProfile } from '../lib/friends';

const MIN_PASSWORD_LENGTH = 6;
const MAX_DISPLAY_NAME_LENGTH = 40;

// Creates a Supabase account. Purely optional groundwork for later
// friends/social features — the game itself never requires this.
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // True once sign-up succeeded but Supabase didn't hand back a session —
  // meaning the project has "Confirm email" turned on and the account
  // needs the emailed link clicked before it can sign in.
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return; // ignore extra taps while a request is already in flight
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    const {
      error: signUpError,
      needsEmailConfirmation: pendingConfirmation,
      userId,
    } = await signUp(trimmedEmail, password);

    if (signUpError) {
      setIsSubmitting(false);
      setError(describeAuthError(signUpError));
      return;
    }

    if (pendingConfirmation) {
      setIsSubmitting(false);
      setNeedsEmailConfirmation(true);
      return;
    }

    // A session came back immediately (email confirmation is off), so the
    // person is already signed in and there's a real request context to
    // write a profile with. If confirmation had been required instead,
    // there'd be no session yet to do this — Settings/Friends fall back to
    // the same default the next time they're opened, signed in.
    if (userId) {
      const fallbackName = trimmedEmail.split('@')[0];
      await ensureProfile(userId, displayName.trim() || fallbackName).catch(() => {
        // Non-fatal: the account still exists; a name can be set later in
        // Settings, or the next Friends-screen visit will pick a default.
      });
    }

    setIsSubmitting(false);
    router.back();
  }

  if (needsEmailConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />
          <View style={styles.headerText}>
            <HeroText style={styles.title}>Create Account</HeroText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.confirmBody}>
          <Panel style={styles.confirmPanel}>
            <BodyText style={styles.confirmText}>
              Check your email to confirm your account, then sign in.
            </BodyText>
            <PrimaryButton label="Go to Sign In" onPress={() => router.replace('/sign-in')} />
          </Panel>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <BackButton />
          <View style={styles.headerText}>
            <HeroText style={styles.title}>Create Account</HeroText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Panel style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
            />
            <TextField
              label="Display Name (optional)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Player"
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              autoComplete="name"
              textContentType="name"
            />

            {error && <BodyText style={styles.error}>{error}</BodyText>}

            <PrimaryButton
              label={isSubmitting ? 'Creating Account…' : 'Create Account'}
              onPress={handleSubmit}
              style={isSubmitting ? styles.buttonDisabled : undefined}
            />

            <PressableOpacity onPress={() => router.replace('/sign-in')}>
              <BodyText style={styles.link}>Already have an account? Sign In</BodyText>
            </PressableOpacity>
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  form: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  error: {
    color: colors.signal,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  link: {
    fontFamily: fonts.primary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  confirmBody: {
    flex: 1,
    justifyContent: 'center',
  },
  confirmPanel: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  confirmText: {
    textAlign: 'center',
    color: colors.textMuted,
  },
});
