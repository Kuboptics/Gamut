import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, typeScale } from '../constants/theme';

// Small uppercase muted caption text — the "technical data" style
// CLAUDE.md describes for labels like HEX, DIFFICULTY, NEXT DROP. Uses
// the primary grotesque (Inter), not the dot-matrix font — see
// constants/theme.ts for the two-font rule.
export function Label({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: typeScale.label,
    color: colors.textMuted,
  },
});
