import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius } from '../constants/theme';

// The "screen embedded in the chassis" raised surface — a subtle fill
// and hairline edge instead of flat black or a hard outline, used for
// every content zone across the app (originally established on the
// Today screen). Callers add their own layout — flex/margin/padding/
// gap — via `style`; this only owns the surface/border/radius.
export function Panel({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.panel, style]} />;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
