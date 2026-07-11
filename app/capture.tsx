import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';

// Lets the player add a photo via the phone's own system camera (its
// native lenses, zoom, and quality handling — no in-app camera view to
// maintain) or from the photo library.
export default function CaptureScreen() {
  const router = useRouter();

  function goToPreview(photoUri: string) {
    // Replace (not push) so the round's Capture <-> Preview screens
    // never pile up in the navigation stack — back always leads to Today.
    router.replace({ pathname: '/preview', params: { photoUri } });
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled) return;

    goToPreview(result.assets[0].uri);
  }

  async function handlePickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (result.canceled) return;

    goToPreview(result.assets[0].uri);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>Add Photo</Label>
      </View>

      <View style={styles.body}>
        <PressableOpacity style={styles.cameraButton} onPress={handleTakePhoto}>
          <DotText style={styles.cameraButtonText}>Camera</DotText>
        </PressableOpacity>
        <PressableOpacity style={styles.libraryButton} onPress={handlePickFromLibrary}>
          <Label>Gallery</Label>
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  cameraButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  cameraButtonText: {
    fontSize: typeScale.button,
  },
  libraryButton: {
    paddingVertical: spacing.sm,
  },
});
