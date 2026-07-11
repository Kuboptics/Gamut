import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { colors, spacing } from '../constants/theme';
import type { Difficulty } from '../lib/scoring';

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  // Route params always come through as strings, so fall back to 'normal'
  // if it's ever missing rather than trust it blindly.
  const difficulty: Difficulty = params.difficulty === 'hard' ? 'hard' : 'normal';

  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  function goToResult(photoUri: string) {
    router.push({ pathname: '/result', params: { photoUri, difficulty } });
  }

  async function handleCapture() {
    if (!cameraRef.current || !isCameraReady || isTakingPhoto) return;
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      goToResult(photo.uri);
    } finally {
      setIsTakingPhoto(false);
    }
  }

  async function handlePickFromLibrary() {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled) return;

    goToResult(picked.assets[0].uri);
  }

  // Permission state hasn't loaded yet.
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Label>Camera access is needed to play</Label>
        <Pressable style={styles.button} onPress={requestPermission}>
          <DotText>Grant access</DotText>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handlePickFromLibrary}>
          <Label>Use library instead</Label>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        onCameraReady={() => setIsCameraReady(true)}
      />
      <View style={styles.controls}>
        <Pressable style={styles.secondaryButton} onPress={handlePickFromLibrary}>
          <Label>Library</Label>
        </Pressable>
        <Pressable
          style={[styles.shutter, !isCameraReady && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={!isCameraReady || isTakingPhoto}
        />
        <View style={styles.controlsSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  controlsSpacer: {
    width: 80,
  },
  secondaryButton: {
    width: 80,
    alignItems: 'flex-start',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.textPrimary,
  },
  shutterDisabled: {
    borderColor: colors.textMuted,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
