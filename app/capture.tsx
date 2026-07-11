import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';

type ChoiceOptionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

// One of the two equally-weighted option blocks below.
function ChoiceOption({ icon, label, onPress }: ChoiceOptionProps) {
  return (
    <PressableOpacity style={styles.option} onPress={onPress}>
      <Ionicons name={icon} size={40} color={colors.textPrimary} />
      <DotText style={styles.optionLabel}>{label}</DotText>
    </PressableOpacity>
  );
}

// Lets the player add a photo via the phone's own system camera (its
// native lenses, zoom, and quality handling — no in-app camera view to
// maintain) or from the photo library. Camera and Gallery are given
// equal visual weight, since they're equally valid ways to add a photo.
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
        <BackButton />
        <Label>Add Photo</Label>
      </View>

      <View style={styles.body}>
        <ChoiceOption icon="camera-outline" label="Camera" onPress={handleTakePhoto} />
        <ChoiceOption icon="images-outline" label="Gallery" onPress={handlePickFromLibrary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLabel: {
    fontSize: typeScale.button,
  },
});
