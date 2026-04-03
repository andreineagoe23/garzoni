import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";

type FormInputProps = TextInputProps & {
  label?: string;
  error?: string;
};

const FormInput = forwardRef<RNTextInput, FormInputProps>(
  ({ label, error, style, ...rest }, ref) => {
    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <RNTextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, error && styles.inputError, style]}
          {...rest}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }
);

FormInput.displayName = "FormInput";
export default FormInput;

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error },
  error: {
    fontSize: typography.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
