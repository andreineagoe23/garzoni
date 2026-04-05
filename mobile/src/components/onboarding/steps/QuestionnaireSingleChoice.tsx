import { Pressable, StyleSheet, Text, View } from "react-native";
import type { QuestionnaireQuestion } from "@monevo/core";
import { colors, radius, shadows, spacing, typography } from "../../../theme/tokens";

type Props = {
  question: QuestionnaireQuestion;
  selected: string | null;
  onChange: (v: string) => void;
};

export default function QuestionnaireSingleChoice({
  question,
  selected,
  onChange,
}: Props) {
  return (
    <View style={styles.optionList}>
      {(question.options ?? []).map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(opt.value)}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
