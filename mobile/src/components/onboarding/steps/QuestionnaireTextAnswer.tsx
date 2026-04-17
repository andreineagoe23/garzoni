import { useMemo } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, spacing, typography } from "../../../theme/tokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
};

export default function QuestionnaireTextAnswer({
  value,
  onChange,
  multiline,
}: Props) {
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
        textInputMulti: {
          height: 110,
          textAlignVertical: "top",
        },
      }),
    [c],
  );

  return (
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMulti]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      placeholder="Type your answer…"
      placeholderTextColor={c.textFaint}
      returnKeyType={multiline ? "default" : "done"}
    />
  );
}
