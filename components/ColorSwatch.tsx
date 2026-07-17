import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/theme';

type ColorSwatchProps = {
  hex: string;
  size?: 'large' | 'small';
  // Rendered centered on top of the swatch fill — used by the Today
  // screen for the color name/hex overlay (see SwatchLabel in
  // app/(tabs)/index.tsx). Omitted everywhere else, identical to before
  // this existed.
  children?: ReactNode;
};

// A solid color block, like a paint chip. "large" is the big daily
// specimen on the Today screen; "small" is used side-by-side on Result.
export function ColorSwatch({ hex, size = 'large', children }: ColorSwatchProps) {
  return (
    <View style={[styles.base, size === 'large' ? styles.large : styles.small, { backgroundColor: hex }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  // "large" fills whatever exact square its parent hands it — see
  // SpecimenFrame on the Today screen, which measures the space
  // available for the swatch and sizes that parent box itself, already
  // clamped to the smaller of available width/height. width/height:
  // '100%' plus aspectRatio: 1 mean this only ever renders as a square,
  // never larger than what it was given. Centers its optional text
  // overlay (children) both ways.
  large: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    width: 130,
    height: 130,
  },
});
