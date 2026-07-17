import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { colors, spacing, typeScale } from '../constants/theme';
import { markIntroSeen } from '../lib/introStorage';
import { BodyText } from './BodyText';
import { HeroText } from './HeroText';
import { Panel } from './Panel';
import { PrimaryButton } from './PrimaryButton';

// The four rules, in the same order as Settings' longer "How It Works"
// panel, condensed to one scannable line each — this is the fast,
// first-glance version; Settings has the full explanation for anyone
// who wants it later.
const INTRO_LINES = [
  "Find today's color somewhere in the real world.",
  'Submit three photos containing it.',
  'Each is scored — the average decides pass or fail at 50%.',
  'Play daily to build your streak.',
];

type IntroModalProps = {
  visible: boolean;
  onClose: () => void;
};

// A small, closable dialog — not a full-screen takeover — explaining the
// game. Shown once automatically on first launch (see app/_layout.tsx)
// and re-openable any time from Settings. Whatever triggers the close
// (the button, a backdrop tap, or Android's hardware back button all
// funnel through the same handler) marks the intro as seen, so it never
// reappears on its own again afterward.
export function IntroModal({ visible, onClose }: IntroModalProps) {
  function handleClose() {
    markIntroSeen().catch(() => {});
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(motionDuration.base).easing(motionEasing)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <Panel style={styles.card}>
          <HeroText style={styles.title}>How To Play</HeroText>

          <View style={styles.rules}>
            {INTRO_LINES.map((line, index) => (
              <View key={index} style={styles.ruleRow}>
                <View style={styles.bullet} />
                <BodyText style={styles.ruleText}>{line}</BodyText>
              </View>
            ))}
          </View>

          <PrimaryButton label="Got It" onPress={handleClose} />
        </Panel>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  rules: {
    gap: spacing.md,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  // A plain muted marker, not red — four simultaneous accent-colored
  // dots would be decoration, not the sparing signal CLAUDE.md reserves
  // red for (the live dot, PASS/FAIL, the flame, the leaderboard #1
  // highlight, and the friend-request alert dot — nothing else).
  bullet: {
    width: 6,
    height: 6,
    marginTop: 7,
    backgroundColor: colors.textMuted,
  },
  ruleText: {
    flex: 1,
    lineHeight: 20,
  },
});
