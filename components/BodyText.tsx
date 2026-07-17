import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../constants/theme';

// The system font, for anything that isn't a small `Label` caption or a
// hero `HeroText` display moment — headings, button labels, list-row
// values. Callers set their own fontSize/weight (fonts.primary/
// primarySemiBold/primaryBold) via `style`, same pattern as `ReadoutText`.
export function BodyText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    ...fonts.primary,
    color: colors.textPrimary,
  },
});
