import { StyleSheet, TextInput } from "react-native";
import { colors, radius, spacing, typography } from "../../../theme/tokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function QuestionnaireNumberAnswer({ value, onChange }: Props) {
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      keyboardType="numeric"
      placeholder="Enter a number"
      placeholderTextColor={colors.textFaint}
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
});
