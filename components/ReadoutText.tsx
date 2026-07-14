import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../constants/theme';

// A clean, precise numeral treatment for the app's two genuine data
// readouts — the target hex code and the daily drop countdown. Work
// Sans (not Fugaz One), with tabular figures so digits stay a fixed
// width and don't jitter side to side as the countdown ticks. See
// constants/theme.ts for the full two-font rule.
export function ReadoutText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.primarySemiBold,
    color: colors.textPrimary,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
