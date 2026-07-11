import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorSwatch } from '../components/ColorSwatch';
import { Divider } from '../components/Divider';
import { DotText } from '../components/DotText';
import { Label } from '../components/Label';
import { PixelSampler } from '../components/PixelSampler';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, spacing, typeScale } from '../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';
import { findBestPatch, type BestPatch } from '../lib/bestPatch';
import { rgbToHex, type RGB } from '../lib/color';
import { getDailyTarget } from '../lib/dailyColor';
import { scoreFromDistance, verdictForScore } from '../lib/scoring';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ photoUri: string }>();
  const router = useRouter();
  const { scores, submitScore } = useRound();

  // Lock in which shot this is at mount time, before submitScore (below)
  // changes the round's score count out from under us.
  const [shotNumber] = useState(() => scores.length + 1);
  const isLastShot = shotNumber === PHOTOS_PER_ROUND;

  // Same date -> same seeded target as the Today screen, so this always
  // scores against the color the player was actually shown.
  const target = getDailyTarget();

  const [sampleImageUri, setSampleImageUri] = useState<string | null>(null);
  const [bestPatch, setBestPatch] = useState<BestPatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSample(tileColors: RGB[]) {
    const patch = findBestPatch(tileColors, target.rgb);
    setBestPatch(patch);
    submitScore(scoreFromDistance(patch.distance));
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

  const score = bestPatch ? scoreFromDistance(bestPatch.distance) : null;
  const verdict = score !== null ? verdictForScore(score) : null;

  function handleContinue() {
    // Replace (not push), matching capture.tsx, so the round's screens
    // never pile up in the navigation stack.
    router.replace(isLastShot ? '/summary' : '/capture');
  }

  function handleRetryPhoto() {
    router.replace('/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Label>
          Shot {shotNumber} of {PHOTOS_PER_ROUND}
        </Label>
      </View>

      <Divider />

      <View style={styles.body}>
        {!bestPatch && !error && <Label>Measuring…</Label>}
        {error && <Label>{error}</Label>}

        {bestPatch && score !== null && (
          <>
            <DotText style={styles.score}>{score}%</DotText>
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
          </>
        )}
      </View>

      {(bestPatch || error) && (
        <>
          <Divider />
          <View style={styles.actions}>
            {error ? (
              <PressableOpacity style={styles.button} onPress={handleRetryPhoto}>
                <DotText>Try again</DotText>
              </PressableOpacity>
            ) : (
              <PressableOpacity style={styles.button} onPress={handleContinue}>
                <DotText>{isLastShot ? 'See Results' : 'Next Shot'}</DotText>
              </PressableOpacity>
            )}
          </View>
        </>
      )}

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
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  score: {
    fontSize: typeScale.display,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  swatchColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  hex: {
    fontSize: typeScale.value,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
