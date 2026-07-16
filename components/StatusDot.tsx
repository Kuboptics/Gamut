import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../constants/theme';

type StatusDotProps = {
  passed: boolean;
};

const SIZE = 8;

// The small pass/fail indicator shown next to a per-shot score (Today's
// completed strip, day-detail's photo rows) — one shared size/shape so
// the same element can't quietly drift to a different size on each
// screen that uses it.
export function StatusDot({ passed }: StatusDotProps) {
  return <View style={[styles.dot, passed ? styles.pass : styles.fail]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.sm,
  },
  pass: {
    backgroundColor: colors.positive,
  },
  fail: {
    backgroundColor: colors.signal,
  },
});
