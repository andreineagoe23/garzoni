import { Pressable, StyleSheet, Text, View } from "react-native";
import type { QuestionnaireQuestion } from "@monevo/core";
import { colors, radius, shadows, spacing, typography } from "../../../theme/tokens";

type Props = {
  question: QuestionnaireQuestion;
  selected: string[];
  onChange: (v: string[]) => void;
};

export default function QuestionnaireMultiChoice({
  question,
  selected,
  onChange,
}: Props) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]
    );
  };
  return (
    <View style={styles.optionList}>
      {(question.options ?? []).map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => toggle(opt.value)}
          >
            <View style={[styles.checkbox, active && styles.checkboxActive]}>
              {active ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionList: { gap: spacing.sm, marginTop: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0d`,
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    marginLeft: spacing.md,
  },
  optionLabelActive: { fontWeight: "600", color: colors.primaryDark },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: "700" },
});
