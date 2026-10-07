import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, typeScale } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { BodyText } from './BodyText';
import { PressableOpacity } from './PressableOpacity';

export type ActionButtonTone = 'positive' | 'signal' | 'neutral';

type ActionButtonProps = {
  label: string;
  tone: ActionButtonTone;
  onPress: () => void;
  // Solid fill instead of the default outline — used for Accept against
  // Decline's outline, and Settings' compact Save, since those are each
  // the one weightier action next to a lighter/secondary one.
  filled?: boolean;
};

// A small, obviously-tappable button for compact row-level actions
// (Copy, Share, Accept, Decline, Save) — deliberately not `PrimaryButton`
// (reserved for one full-width main action per screen) and deliberately
// not plain tappable text.
export function ActionButton({ label, tone, onPress, filled = false }: ActionButtonProps) {
  const { colors } = useTheme();
  // Built fresh every render (not a module-level constant) so a theme
  // switch is reflected immediately — a constant built once at import
  // time would freeze at whichever palette was active the first time
  // this module loaded, and never update again.
  const toneColorByTone: Record<ActionButtonTone, string> = {
    positive: colors.positive,
    signal: colors.signal,
    neutral: colors.textPrimary,
  };
  const toneColor = toneColorByTone[tone];
  const style: StyleProp<ViewStyle> = [
    styles.button,
    filled ? { backgroundColor: toneColor } : { borderColor: toneColor },
  ];
  const labelColor = filled ? colors.background : toneColor;
  return (
    <PressableOpacity style={style} onPress={onPress}>
      <BodyText style={[styles.label, { color: labelColor }]}>{label}</BodyText>
    </PressableOpacity>
  );
}

// Layout/text metrics only — no color here, so this stays a plain
// top-level style rather than needing useThemedStyles.
const styles = StyleSheet.create({
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
