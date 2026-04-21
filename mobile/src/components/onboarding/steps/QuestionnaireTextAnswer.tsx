import { StyleSheet, TextInput } from "react-native";
import { brand } from "../../../theme/brand";

type Props = {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
};

const DARK = {
  surface: brand.bgCard,
  border: brand.borderGlass,
  text: brand.text,
  faint: "rgba(229,231,235,0.4)",
};

export default function QuestionnaireTextAnswer({
  value,
  onChange,
  multiline,
}: Props) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.multi]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      placeholder="Type your answer…"
      placeholderTextColor={DARK.faint}
      returnKeyType={multiline ? "default" : "done"}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: DARK.border,
    backgroundColor: DARK.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: DARK.text,
    marginTop: 10,
  },
  multi: {
    height: 120,
    textAlignVertical: "top",
  },
});
