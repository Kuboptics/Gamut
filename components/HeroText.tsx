import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../constants/theme';

// Bold system font — reserved for large "hero" display moments only: the
// big score/percentage, the streak number, and screen titles (the
// PASS/FAIL verdict word counts as a title-tier moment too). Never body
// copy or small labels — see constants/theme.ts for the full font rule.
// The one exception is the Gamut wordmark on the Today tab, which stays
// Fugaz One (see app/(tabs)/index.tsx's wordmarkTitle style).
export function HeroText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    ...fonts.display,
    color: colors.textPrimary,
  },
});
