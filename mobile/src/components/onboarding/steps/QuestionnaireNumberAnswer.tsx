import { useMemo } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, spacing, typography } from "../../../theme/tokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function QuestionnaireNumberAnswer({ value, onChange }: Props) {
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        textInput: {
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          fontSize: typography.base,
          color: c.text,
          backgroundColor: c.surface,
          marginTop: spacing.md,
        },
      }),
    [c],
  );

  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      keyboardType="numeric"
      placeholder="Enter a number"
      placeholderTextColor={c.textFaint}
      returnKeyType="done"
    />
  );
}
