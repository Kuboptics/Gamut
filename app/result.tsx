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
import { getDailyTarget } from '../lib/dailyColor';
import { scoreMatch, verdictForScore, type Difficulty } from '../lib/scoring';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ photoUri: string; difficulty?: string }>();
  const difficulty: Difficulty = params.difficulty === 'hard' ? 'hard' : 'normal';

  const router = useRouter();
  // Same date -> same seeded target as the Today screen, so this always
  // scores against the color the player was actually shown.
  const target = getDailyTarget();

  const [sampleImageUri, setSampleImageUri] = useState<string | null>(null);
  const [shotColor, setShotColor] = useState<RGB | null>(null);
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

  const score = shotColor ? scoreMatch(target.rgb, shotColor, difficulty) : null;
  const verdict = score !== null ? verdictForScore(score) : null;

  return (
    <View style={styles.container}>
      {!shotColor && !error && <Label>Measuring…</Label>}
      {error && (
        <>
          <Label>{error}</Label>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <DotText>Try again</DotText>
          </Pressable>
        </>
      )}

      {shotColor && score !== null && (
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
              <ColorSwatch hex={rgbToHex(shotColor)} size="small" />
              <Label>Your shot</Label>
              <DotText style={styles.hex}>{rgbToHex(shotColor)}</DotText>
            </View>
          </View>

          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <DotText>Done</DotText>
          </Pressable>
        </>
      )}

      <PixelSampler imageUri={sampleImageUri} onSample={setShotColor} onError={setError} />
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
