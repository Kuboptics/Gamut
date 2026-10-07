import { StyleSheet, Text, type TextProps } from 'react-native';

import { fonts, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../context/ThemeContext';

// Bold system font — reserved for large "hero" display moments only: the
// big score/percentage, the streak number, and screen titles (the
// PASS/FAIL verdict word counts as a title-tier moment too). Never body
// copy or small labels — see constants/theme.ts for the full font rule.
// The one exception is the Gamut wordmark in the shared header, which
// stays Fugaz One (see components/AppHeader.tsx's wordmarkTitle style).
export function HeroText({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text {...props} style={[styles.base, style]} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      ...fonts.display,
      color: colors.textPrimary,
    },
  });
