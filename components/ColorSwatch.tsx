import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/theme';

type ColorSwatchProps = {
  hex: string;
  size?: 'large' | 'small';
};

// A solid color block, like a paint chip. "large" is the big daily
// specimen on the Today screen; "small" is used side-by-side on Result.
export function ColorSwatch({ hex, size = 'large' }: ColorSwatchProps) {
  return (
    <View
      style={[styles.base, size === 'large' ? styles.large : styles.small, { backgroundColor: hex }]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  // "large" fills whatever square the parent gives it: height comes from
  // the flexible container it sits in (see SpecimenFrame on the Today
  // screen), aspectRatio keeps it a square, and maxWidth clamps it back
  // down if that height would make it wider than the container — so it
  // shrinks to fit on short phones instead of overflowing its card.
  large: {
    height: '100%',
    aspectRatio: 1,
    maxWidth: '100%',
  },
  small: {
    width: 130,
    height: 130,
  },
});
