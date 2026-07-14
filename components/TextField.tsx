import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, spacing, typeScale } from '../constants/theme';
import { Label } from './Label';

type TextFieldProps = TextInputProps & {
  label: string;
  // An optional compact control (e.g. a Save button) rendered beside the
  // input instead of below it — used by Settings' Display Name field.
  // Omitted everywhere else, where the input just fills the row alone,
  // identical to before this existed.
  accessory?: ReactNode;
};

// A labeled input for forms — the Account sign up/sign in screens are the
// only place the app collects free text, so this didn't exist before.
// Styled like `Panel` (surface fill, hairline border) rather than the
// default OS text field chrome.
export function TextField({ label, style, accessory, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Label>{label}</Label>
      <View style={styles.row}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          autoCorrect={false}
          {...props}
        />
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.primary,
    fontSize: typeScale.button,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
