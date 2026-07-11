import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors } from '../constants/theme';

// Small uppercase muted caption text — the "technical data" style
// CLAUDE.md describes for labels like HEX, DIFFICULTY, NEXT DROP.
export function Label({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 12,
    color: colors.textMuted,
  },
});
