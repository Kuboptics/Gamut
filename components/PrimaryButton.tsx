import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, typeScale, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';
import { BodyText } from './BodyText';
import { PressableOpacity } from './PressableOpacity';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

// The app's one confident primary control — solid, high-contrast,
// shutter-like, not a hollow outlined rectangle (originally established
// on the Today screen). Used for the single main action on a screen;
// a secondary action next to it should stay plain text, not a second
// PrimaryButton, so the contrast still means something.
export function PrimaryButton({ label, onPress, style }: PrimaryButtonProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableOpacity style={[styles.button, style]} onPress={onPress}>
      <BodyText style={styles.label}>{label}</BodyText>
    </PressableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      backgroundColor: colors.textPrimary,
      borderRadius: radius.sm,
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    label: {
      ...fonts.primarySemiBold,
      fontSize: typeScale.button,
      color: colors.background,
    },
  });
