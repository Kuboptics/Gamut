import { DotGothic16_400Regular, useFonts } from '@expo-google-fonts/dotgothic16';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { motionDuration } from '../constants/motion';
import { colors } from '../constants/theme';
import { RoundProvider } from '../context/RoundContext';
import { StreakProvider } from '../context/StreakContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Keep the splash screen up until the dot-matrix font has loaded, so we
// never flash default system text before switching to the real font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ DotGothic16_400Regular });
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
    <RoundProvider>
      <StreakProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: reducedMotion ? 'none' : 'fade',
            animationDuration: motionDuration.base,
          }}
        />
      </StreakProvider>
    </RoundProvider>
  );
}
