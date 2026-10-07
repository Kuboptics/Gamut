import { StyleSheet, Text, type TextProps } from 'react-native';

import { fonts, typeScale, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';

// Small uppercase muted caption text — the "technical data" style
// CLAUDE.md describes for labels like HEX, DIFFICULTY, NEXT DROP. Uses
// the primary grotesque (the system font), not the display font — see
// constants/theme.ts for the font rule.
export function Label({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text {...props} style={[styles.base, style]} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      ...fonts.primary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      fontSize: typeScale.label,
      color: colors.textMuted,
    },
  });
