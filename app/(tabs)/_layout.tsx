import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/AppHeader';
import { FlameIcon } from '../../components/FlameIcon';
import { PressableOpacity } from '../../components/PressableOpacity';
import { motionDuration } from '../../constants/motion';
import { colors, fonts } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { msUntilNextMidnight } from '../../lib/countdown';

// Gives every tab item the same press feedback as the rest of the app,
// instead of the tab bar's own default (unanimated) touchable.
function TabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  accessibilityState,
  testID,
}: BottomTabBarButtonProps) {
  return (
    <PressableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      testID={testID}
      style={style}
    >
      {children}
    </PressableOpacity>
  );
}

export default function TabsLayout() {
  const reducedMotion = useReducedMotion();

  // The single countdown-to-next-drop timer for the whole app — ticks
  // once a second here and gets passed down to AppHeader, which just
  // formats and displays it. Every tab shares this one interval instead
  // of each screen running its own.
  const [countdownMs, setCountdownMs] = useState(msUntilNextMidnight());
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownMs(msUntilNextMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <AppHeader countdownMs={countdownMs} />
      </SafeAreaView>
      <Tabs
        // A light tick specifically for a physical tap on the tab bar —
        // tabPress only fires for that, not for programmatic navigation
        // (e.g. the swipe gesture in hooks/useTabSwipe.ts fires its own
        // haptic directly, since a swipe never triggers this event).
        screenListeners={{
          tabPress: () => {
            Haptics.selectionAsync().catch(() => {});
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarButton: TabBarButton,
          // Same fade as the root Stack (constants/motion.ts), just a bit
          // quicker (motionDuration.tabSwitch), so switching tabs still
          // reads as the same kind of transition as the rest of the app
          // instead of a hard cut, without feeling sluggish on a gesture
          // players do constantly.
          animation: reducedMotion ? 'none' : 'fade',
          transitionSpec: {
            animation: 'timing',
            config: { duration: motionDuration.tabSwitch },
          },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.textPrimary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            ...fonts.primary,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize: 10,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size }) => <Ionicons name="aperture-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ size }) => <FlameIcon size={size} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Only the top edge — the Tabs navigator below already handles its own
  // bottom safe area (behind the tab bar), so applying it again here
  // would double it up.
  headerSafeArea: {
    backgroundColor: colors.background,
  },
});
