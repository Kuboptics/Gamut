import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, spacing, typeScale } from '../constants/theme';
import { Label } from './Label';

type TextFieldProps = TextInputProps & {
  label: string;
  // A small chip overlaid on the input's own right edge (e.g. the
  // Random name button on app/(tabs)/settings.tsx and app/sign-up.tsx)
  // — not a sibling beside it. Automatically adds extra right padding
  // to the input so typed text never runs under it. Omitted everywhere
  // else, where the input keeps its plain symmetric padding, identical
  // to before this existed.
  accessory?: ReactNode;
};

// A labeled input for forms — the Account sign up/sign in screens are the
// only place the app collects free text, so this didn't exist before.
// Styled like `Panel` (surface fill, hairline border) rather than the
// default OS text field chrome. Forwards its ref to the underlying
// TextInput so a caller can imperatively blur it (e.g. Settings' Display
// Name field, after a save completes) — every existing caller ignores
// the ref and works exactly as before.
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, style, accessory, ...props },
  ref
) {
  return (
    <View style={styles.container}>
      <Label>{label}</Label>
      <View style={styles.row}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, accessory ? styles.inputWithAccessory : null, style]}
          autoCorrect={false}
          {...props}
        />
        {accessory && <View style={styles.accessory}>{accessory}</View>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  // position: 'relative' so `accessory` below can overlay the input's
  // own right edge instead of sitting beside it as a flex sibling —
  // the input is this row's only normal-flow child, so it already
  // stretches to the row's full width via the default column/stretch
  // layout, no explicit flex/width needed.
  row: {
    position: 'relative',
  },
  input: {
    ...fonts.primary,
    fontSize: typeScale.button,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Clears room for the chip so typed text never runs under it. A
  // literal pixel value sized to this app's one "RANDOM" chip rather
  // than measured, since it's the only accessory that exists today.
  inputWithAccessory: {
    paddingRight: 96,
  },
  // Centered over the input's full height, inset from its right edge.
  accessory: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: spacing.sm,
    justifyContent: 'center',
  },
});
