import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { BodyText } from '../components/BodyText';
import { Divider } from '../components/Divider';
import { Label } from '../components/Label';
import { PressableOpacity } from '../components/PressableOpacity';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { PHOTOS_PER_ROUND, useRound } from '../context/RoundContext';

// A short instrument-style hint, low on the screen. Rotates by shot
// number within the round rather than randomly, so each new photo in a
// round gets a different (but predictable) line.
const FRAMING_TIPS = ['FILL THE FRAME WITH THE COLOR', 'EVEN A SMALL PATCH COUNTS', 'GET CLOSE FOR A TRUE MATCH'];

// Shows the photo the player just took or picked, with Keep/Retake.
// Nothing is scored here — scoring only ever happens once, at Submit
// (see app/summary.tsx) — so Keep just banks the photo into its slot
// and is available the instant a photo is shown, with nothing to wait
// on in the background.
export default function PreviewScreen() {
  const params = useLocalSearchParams<{ photoUri: string; slot: string }>();
  const router = useRouter();
  const { setSlot } = useRound();
  const slotIndex = Number(params.slot);
  const framingTip = FRAMING_TIPS[slotIndex % FRAMING_TIPS.length];

  function handleKeep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSlot(slotIndex, params.photoUri);
    // Replace (not push), matching capture.tsx, so the round's screens
    // never pile up in the navigation stack. Always back to Today —
    // filling the last slot no longer auto-advances anywhere; Submit
    // (from the Today screen) is the only way to move on from shooting.
    router.replace('/');
  }

  function handleRetake() {
    router.replace('/capture');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Label>
          Photo {slotIndex + 1} of {PHOTOS_PER_ROUND}
        </Label>
      </View>

      <Divider />

      <View style={styles.photoFrame}>
        <Image source={{ uri: params.photoUri }} style={styles.photo} resizeMode="contain" />
      </View>

      <View style={styles.tipRow}>
        <Label style={styles.tip}>{framingTip}</Label>
      </View>

      <Divider />

      <View style={styles.actions}>
        <PressableOpacity style={styles.retakeButton} onPress={handleRetake}>
          <BodyText style={styles.actionLabel}>Retake</BodyText>
        </PressableOpacity>
        <PressableOpacity style={styles.keepButton} onPress={handleKeep}>
          <BodyText style={styles.actionLabel}>Keep</BodyText>
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
  // Matches PrimaryButton's own label treatment, so Retake/Keep read as
  // the same button-label tier even though these two are outlined
  // rather than solid.
  actionLabel: {
    fontFamily: fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
});
