import { StyleSheet, Text, type TextProps } from 'react-native';

import { fonts, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';

// A clean, precise numeral treatment for the app's two genuine data
// readouts — the target hex code and the daily drop countdown. The
// system font (not Fugaz One), with tabular figures so digits stay a
// fixed width and don't jitter side to side as the countdown ticks. See
// constants/theme.ts for the full font rule.
export function ReadoutText({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text {...props} style={[styles.base, style]} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      ...fonts.primarySemiBold,
      color: colors.textPrimary,
      letterSpacing: 1,
      fontVariant: ['tabular-nums'],
    },
  });
