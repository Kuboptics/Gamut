import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing } from '../constants/theme';

// The camera view fades to black and back whenever facing/lens/zoom
// changes, masking the native camera session's reconfiguration flicker.
// Each half of the fade gets this many ms, so the whole thing is ~200ms.
const CAMERA_TRANSITION_HALF_MS = 100;

// The zoom presets shown as on-screen buttons. expo-camera's `zoom` prop
// is a 0-1 fraction of "however much zoom this device supports" (not a
// real magnification factor — there's no API to read the device's
// actual zoom range), so these are calibrated approximations of
// 1x/2x/5x rather than an exact reading.
const ZOOM_PRESETS: { label: string; zoom: number }[] = [
  { label: '1x', zoom: 0 },
  { label: '2x', zoom: 0.15 },
  { label: '5x', zoom: 0.4 },
];

// The standard single wide-angle lens, as opposed to the ultra-wide,
// telephoto, or virtual multi-lens ("Dual"/"Triple") back cameras.
// Passed explicitly because leaving `selectedLens` unset has been
// observed to default to the ultra-wide lens on some devices.
const WIDE_LENS = 'builtInWideAngleCamera';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoomIndex, setZoomIndex] = useState(0);

  const cameraTransitionOpacity = useSharedValue(0);
  const cameraTransitionStyle = useAnimatedStyle(() => ({
    opacity: cameraTransitionOpacity.value,
  }));
  const isFirstRender = useRef(true);

  // Fade to black and back whenever facing or zoom changes — not on the
  // initial mount, only on subsequent changes.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const config = { duration: CAMERA_TRANSITION_HALF_MS, reduceMotion: ReduceMotion.System } as const;
    cameraTransitionOpacity.value = withSequence(withTiming(1, config), withTiming(0, config));
  }, [facing, zoomIndex, cameraTransitionOpacity]);

  function goToPreview(photoUri: string) {
    // Replace (not push) so the round's Capture <-> Preview screens
    // never pile up in the navigation stack — back always leads to Today.
    router.replace({ pathname: '/preview', params: { photoUri } });
  }

  async function handleCapture() {
    if (!cameraRef.current || !isCameraReady || isTakingPhoto) return;
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      goToPreview(photo.uri);
    } finally {
      setIsTakingPhoto(false);
    }
  }

  async function handlePickFromLibrary() {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled) return;

    goToPreview(picked.assets[0].uri);
  }

  function handleFlipCamera() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setZoomIndex(0); // the front camera's zoom range is different, so reset to 1x
  }

  // Permission state hasn't loaded yet.
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Label>Camera access is needed to play</Label>
        <PressableOpacity style={styles.button} onPress={requestPermission}>
          <DotText>Grant access</DotText>
        </PressableOpacity>
        <PressableOpacity style={styles.secondaryButton} onPress={handlePickFromLibrary}>
          <Label>Use library instead</Label>
        </PressableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          selectedLens={facing === 'back' ? WIDE_LENS : undefined}
          zoom={ZOOM_PRESETS[zoomIndex].zoom}
          onCameraReady={() => setIsCameraReady(true)}
        />
        <Animated.View pointerEvents="none" style={[styles.cameraTransitionOverlay, cameraTransitionStyle]} />
      </View>

      <View style={styles.zoomRow}>
        {ZOOM_PRESETS.map((preset, index) => (
          <PressableOpacity
            key={preset.label}
            style={[styles.zoomButton, index === zoomIndex && styles.zoomButtonActive]}
            onPress={() => setZoomIndex(index)}
          >
            <Label style={index === zoomIndex && styles.zoomLabelActive}>{preset.label}</Label>
          </PressableOpacity>
        ))}
      </View>

      <View style={[styles.controls, { paddingBottom: spacing.lg + insets.bottom }]}>
        <PressableOpacity style={styles.sideButton} onPress={handlePickFromLibrary}>
          <Ionicons name="images-outline" size={28} color={colors.textPrimary} />
        </PressableOpacity>
        <PressableOpacity
          style={[styles.shutter, !isCameraReady && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={!isCameraReady || isTakingPhoto}
        />
        <PressableOpacity style={[styles.sideButton, styles.sideButtonRight]} onPress={handleFlipCamera}>
          <Ionicons name="camera-reverse-outline" size={28} color={colors.textPrimary} />
        </PressableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraTransitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  zoomRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  zoomButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  zoomButtonActive: {
    backgroundColor: colors.surface,
  },
  zoomLabelActive: {
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sideButton: {
    width: 72,
  },
  sideButtonRight: {
    alignItems: 'flex-end',
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
    paddingHorizontal: spacing.xl,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
  },
});
