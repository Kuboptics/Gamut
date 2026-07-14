import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, spacing, typeScale } from '../constants/theme';
import { Label } from './Label';

type TextFieldProps = TextInputProps & {
  label: string;
};

// A labeled input for forms — the Account sign up/sign in screens are the
// only place the app collects free text, so this didn't exist before.
// Styled like `Panel` (surface fill, hairline border) rather than the
// default OS text field chrome.
export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  input: {
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
