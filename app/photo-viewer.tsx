import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText } from '../components/BodyText';
import { PressableOpacity } from '../components/PressableOpacity';
import { fonts, spacing, typeScale, type ThemeColors } from '../constants/theme';
import { PHOTOS_PER_ROUND } from '../context/RoundContext';
import { useThemedStyles } from '../context/ThemeContext';

// "contain" sizing math: the largest box with `image`'s aspect ratio
// that still fits inside `available` — same result resizeMode="contain"
// would render, just computed ahead of time so the wrapper view below
// can be sized to exactly the visible picture (not its letterboxed
// bounding box), for rounding the picture's own corners.
function containSize(
  image: { width: number; height: number } | null,
  available: { width: number; height: number }
): { width: number; height: number } {
  if (!image || available.width === 0 || available.height === 0) return available;
  const imageRatio = image.width / image.height;
  const availableRatio = available.width / available.height;
  if (imageRatio > availableRatio) return { width: available.width, height: available.width / imageRatio };
  return { width: available.height * imageRatio, height: available.height };
}

// A simple full-screen viewer for one already-banked photo — just the
// photo and a close button, no score or verdict. An optional `slot`
// param (passed only by app/(tabs)/index.tsx's RoundProgress, for a
// still-in-progress round) also shows a Retake button, using the same
// navigation back into Capture that app/preview.tsx's own Retake uses.
// Opened without a valid slot — e.g. CompletedToday's post-submit photos
// — this looks exactly as it did before: just Close.
export default function PhotoViewerScreen() {
  const params = useLocalSearchParams<{ photoUri: string; slot?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);

  const parsedSlot = Number(params.slot);
  const isValidSlot = Number.isInteger(parsedSlot) && parsedSlot >= 0 && parsedSlot < PHOTOS_PER_ROUND;

  // The frame's available room (measured) and the photo's own natural
  // pixel size (fetched once per uri) — together these size pictureBox
  // below to exactly the rendered picture, so its rounded corners land
  // on the picture itself rather than on empty letterboxed space.
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setImageSize(null);
    if (!params.photoUri) return;
    let cancelled = false;
    Image.getSize(
      params.photoUri,
      (width, height) => {
        if (!cancelled) setImageSize({ width, height });
      },
      () => {
        // Unreadable size; pictureBox falls back to the full frame below.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [params.photoUri]);

  function handleFrameLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setFrameSize({ width, height });
  }

  const pictureBox = containSize(imageSize, frameSize);

  function handleRetake() {
    router.replace({ pathname: '/capture', params: { slot: params.slot } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.photoFrame}>
        <View style={styles.photoMeasureArea} onLayout={handleFrameLayout}>
          <View style={[styles.pictureBox, pictureBox]}>
            <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="contain" />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PressableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <BodyText style={styles.actionLabel}>Close</BodyText>
        </PressableOpacity>
        {isValidSlot && (
          <PressableOpacity style={styles.retakeButton} onPress={handleRetake}>
            <BodyText style={styles.actionLabel}>Retake</BodyText>
          </PressableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  photoFrame: {
    flex: 1,
    padding: spacing.xl,
  },
  // Fills photoFrame's own padded-in space — onLayout here measures
  // exactly the room available to the picture, with no manual padding
  // subtraction needed.
  photoMeasureArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sized by pictureBox (see containSize) to the picture's own rendered
  // dimensions, so overflow: hidden clips exactly at the picture's edges
  // — the iOS-style rounding lands on the photo itself, never on
  // letterboxed empty space around it.
  pictureBox: {
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  // Close (left) always renders; Retake (right) only when there's a
  // valid slot. flex: 1 on both buttons below means Close alone still
  // stretches to the row's full width when Retake is absent.
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  // retakeButton and closeButton below are styled identically on
  // purpose — one quiet look for both, dim border and no fill, rounded
  // to match this screen's photo (see pictureBox above).
  retakeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  closeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  // Explicit color, not left to BodyText's own default — before this
  // screen was migrated, BodyText (already theme-aware) could resolve
  // to the live theme's text color while this screen's own background
  // stayed on the static dark value, so a light-mode viewer showed
  // near-black text (correctly resolved) on a background stuck dark
  // (not yet resolved) — invisible by coincidence, not by design. Now
  // that container/closeButton/retakeButton all read from the same
  // `colors` this label does, they can't drift apart like that again.
  actionLabel: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
    color: colors.textPrimary,
  },
});
