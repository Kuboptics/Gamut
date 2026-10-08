import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { PressableOpacity } from '../../components/PressableOpacity';
import { useTheme } from '../../context/ThemeContext';
import { CountdownProvider } from '../../lib/CountdownContext';

// Gives every tab item the same press feedback as the rest of the app,
// instead of the tab bar's own default (unanimated) touchable.
// Currently unused now that NativeTabs (the system tab bar) owns its own
// press feedback and doesn't accept a custom tabBarButton — left in place
// in case a future screen needs the same press treatment elsewhere.
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
  const { colors } = useTheme();

  return (
    <ThemeProvider value={DarkTheme}>
      <CountdownProvider>
        {/* tintColor colors the active tab's icon and label. Without it,
            iOS falls back to its own system blue, which clashes with the
            monochrome palette. textPrimary flips with the theme (white
            in dark, near-black in light). */}
        <NativeTabs tintColor={colors.textPrimary}>
          <NativeTabs.Trigger name="index">
            <Label>Today</Label>
            <Icon sf="camera.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="progress">
            <Label>Progress</Label>
            <Icon sf="calendar" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="friends">
            <Label>Friends</Label>
            <Icon sf="person.2.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <Label>Settings</Label>
            <Icon sf="gearshape.fill" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </CountdownProvider>
    </ThemeProvider>
  );
}
