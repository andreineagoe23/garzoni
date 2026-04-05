import { StyleSheet, TextInput } from "react-native";
import { colors, radius, spacing, typography } from "../../../theme/tokens";

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
  return (
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMulti]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      placeholder="Type your answer…"
      placeholderTextColor={colors.textFaint}
      returnKeyType={multiline ? "default" : "done"}
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
  textInputMulti: {
    height: 110,
    textAlignVertical: "top",
  },
});
