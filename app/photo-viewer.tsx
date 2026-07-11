import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DotText } from '../components/DotText';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing } from '../constants/theme';

// A simple full-screen viewer for one already-banked photo — just the
// photo and a close button, no score or verdict.
export default function PhotoViewerScreen() {
  const params = useLocalSearchParams<{ photoUri: string }>();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.photoFrame}>
        <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="contain" />
      </View>

      <View style={styles.actions}>
        <PressableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <DotText>Close</DotText>
        </PressableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  photoFrame: {
    flex: 1,
    padding: spacing.xl,
  },
  photo: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
