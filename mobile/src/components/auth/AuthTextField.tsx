import React, { forwardRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { authBrand } from "../../theme/authBrand";
import { radius, spacing, typography } from "../../theme/tokens";

type Props = TextInputProps & {
  label: string;
};

const AuthTextField = forwardRef<TextInput, Props>(
  ({ label, style, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={authBrand.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, focused && styles.inputFocused, style]}
          {...rest}
        />
      </View>
    );
  },
);

AuthTextField.displayName = "AuthTextField";
export default AuthTextField;

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: authBrand.textLabel,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: authBrand.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.base,
    color: authBrand.text,
    backgroundColor: authBrand.inputBg,
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  inputFocused: {
    borderColor: authBrand.accent,
    ...Platform.select({
      ios: {
        shadowColor: authBrand.accent,
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      default: {},
    }),
  },
});
