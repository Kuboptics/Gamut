import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { IntroModal } from '../components/IntroModal';
import { LaunchAnimation } from '../components/LaunchAnimation';
import { PushNotificationSetup } from '../components/PushNotificationSetup';
import { motionDuration } from '../constants/motion';
import { AuthProvider } from '../context/AuthContext';
import { HistoryProvider } from '../context/HistoryContext';
import { OverlayProvider } from '../context/OverlayContext';
import { ReminderProvider } from '../context/ReminderContext';
import { RoundProvider } from '../context/RoundContext';
import { StreakProvider } from '../context/StreakContext';
import { SyncProvider } from '../context/SyncContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { hasSeenIntro } from '../lib/introStorage';

// Keep the splash screen up until Fugaz One (the wordmark font) has
// loaded, so we never flash default system text before switching to it.
// Everything else already uses the system font, so there's nothing else
// to wait on.
SplashScreen.preventAutoHideAsync();

// ThemeProvider (context/ThemeContext.tsx) wraps everything below so
// every provider/screen underneath it can eventually call useTheme() —
// RootLayoutContent is the first and, for now, only consumer, since no
// other file migrates off the static `colors` export in this step.
export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({
    FugazOne_400Regular,
  });
  const reducedMotion = useReducedMotion();
  const { colors, scheme, isThemeLoaded } = useTheme();

  // Gates the IntroModal and covers the screen until the launch
  // animation's fade-out finishes — see components/LaunchAnimation.tsx.
  const [launchAnimationDone, setLaunchAnimationDone] = useState(false);

  // Shown once, the very first time the app is ever opened on this
  // device — see components/IntroModal.tsx and lib/introStorage.ts.
  // Starts false so it never flashes on for a returning player while
  // this check is still in flight.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    hasSeenIntro().then((seen) => {
      if (!seen) setShowIntro(true);
    });
  }, []);

  // Waits on the theme preference too (not just fonts) before ever
  // hiding the splash screen — otherwise the real app could render one
  // frame with the wrong (default/system) scheme while AsyncStorage is
  // still being read, flashing dark before snapping to a saved light
  // preference. The native splash image stays up the whole time either
  // way, so there's no blank frame underneath it.
  useEffect(() => {
    if (fontsLoaded && isThemeLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isThemeLoaded]);

  if (!fontsLoaded || !isThemeLoaded) {
    return null; // splash screen is still covering the app at this point
  }

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <OverlayProvider>
      <AuthProvider>
        <RoundProvider>
          <HistoryProvider>
            <StreakProvider>
              <ReminderProvider>
                <SyncProvider>
                  <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                  <NavigationThemeProvider value={navigationTheme}>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                        animation: reducedMotion ? 'none' : 'fade',
                        animationDuration: motionDuration.base,
                      }}
                    />
                  </NavigationThemeProvider>
                  <IntroModal
                    visible={showIntro && launchAnimationDone}
                    onClose={() => setShowIntro(false)}
                  />
                  <PushNotificationSetup />
                  {!launchAnimationDone && (
                    <LaunchAnimation onDone={() => setLaunchAnimationDone(true)} />
                  )}
                </SyncProvider>
              </ReminderProvider>
            </StreakProvider>
          </HistoryProvider>
        </RoundProvider>
      </AuthProvider>
    </OverlayProvider>
  );
}
