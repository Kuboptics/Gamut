import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../constants/theme';

// Text in the dot-matrix display font — used for numerals, hex codes,
// and the big score readout, per CLAUDE.md's typography rules.
export function DotText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
});
