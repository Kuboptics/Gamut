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
  large: {
    width: 220,
    height: 220,
  },
  small: {
    width: 130,
    height: 130,
  },
});
