import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../constants/theme';

// Fugaz One — reserved for large "hero" display moments only: the big
// score/percentage, the streak number, and screen titles (the PASS/FAIL
// verdict word counts as a title-tier moment too). Never body copy or
// small labels — see constants/theme.ts for the full two-font rule.
export function HeroText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.hero,
    color: colors.textPrimary,
  },
});
