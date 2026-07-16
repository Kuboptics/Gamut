import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { WorkSans_400Regular, WorkSans_600SemiBold, WorkSans_700Bold } from '@expo-google-fonts/work-sans';
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
import { ReminderProvider } from '../context/ReminderContext';
import { RoundProvider } from '../context/RoundContext';
import { StreakProvider } from '../context/StreakContext';
import { SyncProvider } from '../context/SyncContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { hasSeenIntro } from '../lib/introStorage';

// Keep the splash screen up until both font families have loaded, so we
// never flash default system text before switching to the real ones.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FugazOne_400Regular,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
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
  );
}
