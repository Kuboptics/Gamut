import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';

import { FlameIcon } from '../../components/FlameIcon';
import { PressableOpacity } from '../../components/PressableOpacity';
import { motionDuration } from '../../constants/motion';
import { colors, fonts } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: TabBarButton,
        // Same fade + duration as the root Stack (constants/motion.ts),
        // so switching tabs feels like the same transition as every
        // other screen change in the app, instead of a hard cut.
        animation: reducedMotion ? 'none' : 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: motionDuration.base },
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.primary,
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
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
