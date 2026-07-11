import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PixelSampler } from '../components/PixelSampler';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';
import { findBestPatch, type BestPatch } from '../lib/bestPatch';
import type { RGB } from '../lib/color';
import { getDailyTarget } from '../lib/dailyColor';
import { scoreFromDistance } from '../lib/scoring';

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
    const newCount = bankPhoto(score);
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
        <Label>
          Photo {scores.length + 1} of {PHOTOS_PER_ROUND}
        </Label>
      </View>

      <Divider />

      <View style={styles.body}>
        <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="cover" />
        {!bestPatch && !error && <Label style={styles.status}>Preparing…</Label>}
        {error && <Label style={styles.status}>{error}</Label>}
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
          <DotText style={styles.keepButtonText}>Keep</DotText>
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
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  status: {
    textAlign: 'center',
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
  keepButtonText: {
    fontSize: typeScale.button,
  },
});
