import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { IntroModal } from '../components/IntroModal';
import { PushNotificationSetup } from '../components/PushNotificationSetup';
import { ThemeSwitchFade } from '../components/ThemeSwitchFade';
import { motionDuration, motionEasing, motionReduceMotion } from '../constants/motion';
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

// Must match expo-splash-screen's backgroundColor in app.json. It sits
// behind the launch fade below, so while the app fades in it reads as
// the splash dissolving into the app rather than a blank frame.
const SPLASH_BACKGROUND = '#121212';

// Well past the 350ms launch fade: if the app still isn't fully visible
// by then, something went wrong and it's forced visible.
const LAUNCH_FADE_FALLBACK_MS = 1000;

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
  const isReady = fontsLoaded && isThemeLoaded;

  // The cold-launch fade: the whole app starts invisible and fades in
  // once, at the same moment the splash hides. This component stays
  // mounted while the app is in the background, so coming back to the
  // app never replays it — only a fresh launch does. With Reduce Motion
  // on it jumps straight to fully visible. The hook value can still be
  // loading on the very first frame, so motionReduceMotion (which reads
  // the OS setting directly) is the backup that also skips the fade.
  const launchOpacity = useSharedValue(0);
  const launchFadeStyle = useAnimatedStyle(() => ({ opacity: launchOpacity.value }));

  useEffect(() => {
    if (!isReady) return;
    SplashScreen.hideAsync();
    if (reducedMotion) {
      launchOpacity.value = 1;
    } else {
      launchOpacity.value = withTiming(1, {
        duration: motionDuration.launchFade,
        easing: motionEasing,
        reduceMotion: motionReduceMotion,
      });
    }

    // Safety net: if the animation is ever interrupted and never
    // finishes, force the app fully visible anyway so it can't stay
    // stuck invisible. Setting the value directly also stops any
    // animation still running on it.
    const fallback = setTimeout(() => {
      launchOpacity.value = 1;
    }, LAUNCH_FADE_FALLBACK_MS);
    return () => clearTimeout(fallback);
    // Only isReady should start this: reducedMotion changing later (or
    // resolving after launch) must not restart the fade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  if (!isReady) {
    return null; // splash screen is still covering the app at this point
  }

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <View style={styles.launchBackdrop}>
      <Animated.View style={[styles.launchFade, launchFadeStyle]}>
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
                      <IntroModal visible={showIntro} onClose={() => setShowIntro(false)} />
                      <PushNotificationSetup />
                    </SyncProvider>
                  </ReminderProvider>
                </StreakProvider>
              </HistoryProvider>
            </RoundProvider>
          </AuthProvider>
        </OverlayProvider>
      </Animated.View>
      {/* Above everything else, so its cover hides the whole app (tab bar
          included) while the light/dark switch dissolves. */}
      <ThemeSwitchFade />
    </View>
  );
}

const styles = StyleSheet.create({
  launchBackdrop: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
  launchFade: {
    flex: 1,
  },
});
