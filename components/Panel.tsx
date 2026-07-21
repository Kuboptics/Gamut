import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius } from '../constants/theme';
import { getDailyAccent } from '../lib/dailyColor';

type PanelProps = ViewProps & {
  // The day's hue (0-360, from DailyTarget/DayRecord) to tint this panel
  // with. Optional — omit it and Panel renders exactly the same fixed
  // neutral surface/border it always has (see getDailyAccent for how the
  // hue gets tamed into something legible).
  hue?: number;
};

// The "screen embedded in the chassis" raised surface — a subtle fill
// and hairline edge instead of flat black or a hard outline, used for
// every content zone across the app (originally established on the
// Today screen). Callers add their own layout — flex/margin/padding/
// gap — via `style`; this only owns the surface/border/radius.
export function Panel({ style, hue, ...props }: PanelProps) {
  const accent = hue !== undefined ? getDailyAccent(hue) : null;
  return (
    <View
      {...props}
      style={[
        styles.panel,
        accent && { backgroundColor: accent.background, borderColor: accent.border },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
