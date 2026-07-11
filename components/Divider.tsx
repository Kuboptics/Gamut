import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../constants/theme';

// A 1px hairline used to separate zones on screen — per CLAUDE.md's
// "hairline dividers rather than heavy boxed borders."
export function Divider({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
