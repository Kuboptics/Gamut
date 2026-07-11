import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colors } from '../constants/theme';
import { PressableOpacity } from './PressableOpacity';

// A small, subtle back affordance for screens that sit on top of the
// tab bar (and, since headerShown is off everywhere, would otherwise
// have no way back at all). Always goes to whatever is directly behind
// this screen — Today, given how this app's screens navigate.
export function BackButton() {
  const router = useRouter();

  return (
    <PressableOpacity style={styles.button} hitSlop={8} onPress={() => router.back()}>
      <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
    </PressableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
