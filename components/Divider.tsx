import { StyleSheet, View, type ViewProps } from 'react-native';

import type { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';

// A 1px hairline used to separate zones on screen — per CLAUDE.md's
// "hairline dividers rather than heavy boxed borders."
export function Divider({ style, ...props }: ViewProps) {
  const styles = useThemedStyles(makeStyles);
  return <View {...props} style={[styles.divider, style]} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
  });
