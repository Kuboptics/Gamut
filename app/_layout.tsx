import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { WorkSans_400Regular, WorkSans_600SemiBold, WorkSans_700Bold } from '@expo-google-fonts/work-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { motionDuration } from '../constants/motion';
import { colors } from '../constants/theme';
import { AuthProvider } from '../context/AuthContext';
import { HistoryProvider } from '../context/HistoryContext';
import { ReminderProvider } from '../context/ReminderContext';
import { RoundProvider } from '../context/RoundContext';
import { StreakProvider } from '../context/StreakContext';
import { SyncProvider } from '../context/SyncContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

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
        <StreakProvider>
          <HistoryProvider>
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
              </SyncProvider>
            </ReminderProvider>
          </HistoryProvider>
        </StreakProvider>
      </RoundProvider>
    </AuthProvider>
  );
}
