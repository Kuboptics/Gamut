import { DotGothic16_400Regular, useFonts } from '@expo-google-fonts/dotgothic16';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '../constants/theme';
import { RoundProvider } from '../context/RoundContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Keep the splash screen up until the dot-matrix font has loaded, so we
// never flash default system text before switching to the real font.
SplashScreen.preventAutoHideAsync();

// Screen-to-screen transition timing — short and quiet, per CLAUDE.md's
// "motion is minimal and purposeful."
const SCREEN_TRANSITION_DURATION_MS = 220;

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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reducedMotion ? 'none' : 'fade',
          animationDuration: SCREEN_TRANSITION_DURATION_MS,
        }}
      />
    </RoundProvider>
  );
}
