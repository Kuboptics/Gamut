import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { IntroModal } from '../components/IntroModal';
import { motionDuration } from '../constants/motion';
import { colors } from '../constants/theme';
import { AuthProvider } from '../context/AuthContext';
import { HistoryProvider } from '../context/HistoryContext';
import { OverlayProvider } from '../context/OverlayContext';
import { ReminderProvider } from '../context/ReminderContext';
import { RoundProvider } from '../context/RoundContext';
import { StreakProvider } from '../context/StreakContext';
import { SyncProvider } from '../context/SyncContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { hasSeenIntro } from '../lib/introStorage';

// Keep the splash screen up until Fugaz One (the wordmark font) has
// loaded, so we never flash default system text before switching to it.
// Everything else already uses the system font, so there's nothing else
// to wait on.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FugazOne_400Regular,
  });
  const reducedMotion = useReducedMotion();

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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // splash screen is still covering the app at this point
  }

  return (
    <OverlayProvider>
      <AuthProvider>
        <RoundProvider>
          <HistoryProvider>
            <StreakProvider>
              <ReminderProvider>
                <SyncProvider>
                  <StatusBar style="light" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                      animation: reducedMotion ? 'none' : 'fade',
                      animationDuration: motionDuration.base,
                    }}
                  />
                  <IntroModal visible={showIntro} onClose={() => setShowIntro(false)} />
                </SyncProvider>
              </ReminderProvider>
            </StreakProvider>
          </HistoryProvider>
        </RoundProvider>
      </AuthProvider>
    </OverlayProvider>
  );
}
