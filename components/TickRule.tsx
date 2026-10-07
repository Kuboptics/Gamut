import { StyleSheet, View } from 'react-native';

import type { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';

// A measured, ruler-style row of tick marks — a fine section-break
// inside a Panel, in place of a plain hairline Divider. Every 4th mark
// is slightly taller, like a real ruler, for a bit of "engineered"
// detail density (originally established on the Today screen).
const TICK_RULE_COUNT = 17;

export function TickRule() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tickRule}>
      {Array.from({ length: TICK_RULE_COUNT }).map((_, index) => (
        <View key={index} style={[styles.tickRuleMark, index % 4 === 0 && styles.tickRuleMarkTall]} />
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tickRule: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      width: '100%',
      height: 8,
    },
    tickRuleMark: {
      width: 1,
      height: 4,
      backgroundColor: colors.border,
    },
    tickRuleMarkTall: {
      height: 8,
      backgroundColor: colors.textMuted,
    },
  });
