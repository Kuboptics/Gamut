import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../components/BodyText';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, fonts, spacing, typeScale } from '../constants/theme';

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
          <BodyText style={styles.closeLabel}>Close</BodyText>
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
  closeLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
});
