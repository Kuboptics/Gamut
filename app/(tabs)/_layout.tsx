import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';

import { PressableOpacity } from '../../components/PressableOpacity';
import { colors } from '../../constants/theme';

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: TabBarButton,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
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
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="streak"
        options={{
          title: 'Streak',
          tabBarIcon: ({ color, size }) => <Ionicons name="flame-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
