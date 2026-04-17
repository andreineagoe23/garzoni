import React, { forwardRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

type FormInputProps = TextInputProps & {
  label?: string;
  error?: string;
};

const FormInput = forwardRef<RNTextInput, FormInputProps>(
  ({ label, error, style, ...rest }, ref) => {
    const c = useThemeColors();
    const styles = useMemo(
      () =>
        StyleSheet.create({
          wrapper: { marginBottom: spacing.md },
          label: {
            fontSize: typography.sm,
            fontWeight: "600",
            color: c.text,
            marginBottom: spacing.xs,
          },
          input: {
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
            fontSize: typography.base,
            color: c.text,
            backgroundColor: c.surface,
          },
          inputError: { borderColor: c.error },
          error: {
            fontSize: typography.xs,
            color: c.error,
            marginTop: spacing.xs,
          },
        }),
      [c],
    );

    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <RNTextInput
          ref={ref}
          placeholderTextColor={c.textFaint}
          style={[styles.input, error && styles.inputError, style]}
          {...rest}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

FormInput.displayName = "FormInput";
export default FormInput;
