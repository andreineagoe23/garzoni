import { StyleSheet, TextInput } from "react-native";
import { brand } from "../../../theme/brand";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const DARK = {
  surface: brand.bgCard,
  border: brand.borderGlass,
  text: brand.text,
  faint: "rgba(229,231,235,0.4)",
};

export default function QuestionnaireNumberAnswer({ value, onChange }: Props) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      keyboardType="numeric"
      placeholder="Enter a number"
      placeholderTextColor={DARK.faint}
      returnKeyType="done"
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
});
