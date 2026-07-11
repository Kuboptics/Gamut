import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ColorSwatch } from '../components/ColorSwatch';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PixelSampler } from '../components/PixelSampler';
import { colors, spacing } from '../constants/theme';
import { rgbToHex, type RGB } from '../lib/color';
import { findBestPatch, type BestPatch } from '../lib/bestPatch';
import { getDailyTarget } from '../lib/dailyColor';
import { scoreFromDistance, verdictForScore, type Difficulty } from '../lib/scoring';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ photoUri: string; difficulty?: string }>();
  const difficulty: Difficulty = params.difficulty === 'hard' ? 'hard' : 'normal';

  const router = useRouter();
  // Same date -> same seeded target as the Today screen, so this always
  // scores against the color the player was actually shown.
  const target = getDailyTarget();

  const [sampleImageUri, setSampleImageUri] = useState<string | null>(null);
  const [bestPatch, setBestPatch] = useState<BestPatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSample(tileColors: RGB[]) {
    setBestPatch(findBestPatch(tileColors, target.rgb));
  }

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

  const score = bestPatch ? scoreFromDistance(bestPatch.distance, difficulty) : null;
  const verdict = score !== null ? verdictForScore(score) : null;

  return (
    <View style={styles.container}>
      {!bestPatch && !error && <Label>Measuring…</Label>}
      {error && (
        <>
          <Label>{error}</Label>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <DotText>Try again</DotText>
          </Pressable>
        </>
      )}

      {bestPatch && score !== null && (
        <>
          <DotText style={styles.score}>{score}</DotText>
          <Label>{verdict}</Label>

          <View style={styles.swatchRow}>
            <View style={styles.swatchColumn}>
              <ColorSwatch hex={target.hex} size="small" />
              <Label>Target</Label>
              <DotText style={styles.hex}>{target.hex}</DotText>
            </View>
            <View style={styles.swatchColumn}>
              <ColorSwatch hex={rgbToHex(bestPatch.color)} size="small" />
              <Label>Your shot</Label>
              <DotText style={styles.hex}>{rgbToHex(bestPatch.color)}</DotText>
            </View>
          </View>

          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <DotText>Done</DotText>
          </Pressable>
        </>
      )}

      <PixelSampler imageUri={sampleImageUri} onSample={handleSample} onError={setError} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  score: {
    fontSize: 72,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  swatchColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  hex: {
    fontSize: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
});
