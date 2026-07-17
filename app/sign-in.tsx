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

// Signs into an existing Supabase account. Purely optional groundwork for
// later friends/social features — the game itself never requires this.
export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return; // ignore extra taps while a request is already in flight
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length === 0) {
      setError('Enter your password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (signInError) {
      setError(describeAuthError(signInError));
      return;
    }

    router.back();
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
            <HeroText style={styles.title}>Sign In</HeroText>
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
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />

            {error && <BodyText style={styles.error}>{error}</BodyText>}

            <PrimaryButton
              label={isSubmitting ? 'Signing In…' : 'Sign In'}
              onPress={handleSubmit}
              style={isSubmitting ? styles.buttonDisabled : undefined}
            />

            <PressableOpacity onPress={() => router.replace('/sign-up')}>
              <BodyText style={styles.link}>New here? Create Account</BodyText>
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
    ...fonts.primary,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
