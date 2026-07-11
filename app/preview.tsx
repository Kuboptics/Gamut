import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PixelSampler } from '../components/PixelSampler';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing } from '../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';
import { findBestPatch, type BestPatch } from '../lib/bestPatch';
import type { RGB } from '../lib/color';
import { getDailyTarget } from '../lib/dailyColor';
import { scoreFromDistance } from '../lib/scoring';

// A short instrument-style hint, low on the screen. Rotates by shot
// number within the round rather than randomly, so each new photo in a
// round gets a different (but predictable) line.
const FRAMING_TIPS = ['FILL THE FRAME WITH THE COLOR', 'EVEN A SMALL PATCH COUNTS', 'GET CLOSE FOR A TRUE MATCH'];

// Shows the photo the player just took or picked, with Keep/Retake — no
// score is shown here. The photo is silently scored in the background
// (so Keep can respond instantly) but that score stays hidden until the
// round's 3rd photo is banked and the Summary screen reveals everything
// at once.
export default function PreviewScreen() {
  const params = useLocalSearchParams<{ photoUri: string }>();
  const router = useRouter();
  const { scores, bankPhoto } = useRound();
  const target = getDailyTarget();
  const framingTip = FRAMING_TIPS[scores.length % FRAMING_TIPS.length];

  const [sampleImageUri, setSampleImageUri] = useState<string | null>(null);
  const [bestPatch, setBestPatch] = useState<BestPatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepareSample() {
      try {
        // Shrink the photo before sampling — the WebView doesn't need to
        // load a full multi-megapixel photo just to average its pixels.
        const manipulated = await ImageManipulator.manipulateAsync(
          params.photoUri,
          [{ resize: { width: 200 } }],
          { base64: true, format: ImageManipulator.SaveFormat.JPEG }
        );
        if (!cancelled) {
          setSampleImageUri(`data:image/jpeg;base64,${manipulated.base64}`);
        }
      } catch {
        if (!cancelled) setError('Could not read that photo.');
      }
    }

    prepareSample();
    return () => {
      cancelled = true;
    };
  }, [params.photoUri]);

  function handleSample(tileColors: RGB[]) {
    setBestPatch(findBestPatch(tileColors, target.rgb));
  }

  function handleKeep() {
    if (!bestPatch) return; // scoring isn't ready yet; button is disabled until then
    const score = scoreFromDistance(bestPatch.distance);
    const newCount = bankPhoto(score, params.photoUri);
    // Replace (not push), matching capture.tsx, so the round's screens
    // never pile up in the navigation stack.
    router.replace(newCount >= PHOTOS_PER_ROUND ? '/summary' : '/');
  }

  function handleRetake() {
    router.replace('/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Label>
          Photo {scores.length + 1} of {PHOTOS_PER_ROUND}
        </Label>
      </View>

      <Divider />

      <View style={styles.photoFrame}>
        <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="contain" />
      </View>

      <View style={styles.tipRow}>
        <DotText style={styles.tip}>{framingTip}</DotText>
      </View>

      <Divider />

      <View style={styles.actions}>
        <PressableOpacity style={styles.retakeButton} onPress={handleRetake}>
          <DotText>Retake</DotText>
        </PressableOpacity>
        <PressableOpacity
          style={[styles.keepButton, !bestPatch && styles.keepButtonDisabled]}
          onPress={handleKeep}
          disabled={!bestPatch}
        >
          <DotText>Keep</DotText>
        </PressableOpacity>
      </View>

      <PixelSampler imageUri={sampleImageUri} onSample={handleSample} onError={setError} />
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
  // The photo gets all the remaining space between the header and the
  // action buttons — it fills and centers within whatever room is
  // actually available, rather than forcing a fixed aspect ratio that
  // could overflow on a smaller screen or a differently-shaped photo.
  photoFrame: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  photo: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  tip: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  retakeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keepButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.textPrimary,
  },
  keepButtonDisabled: {
    borderColor: colors.textMuted,
  },
});
