import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { QuestionnaireQuestion } from "@garzoni/core";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, shadows, spacing, typography } from "../../../theme/tokens";

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
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        optionList: { gap: spacing.sm, marginTop: spacing.md },
        option: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1.5,
          borderColor: c.border,
          ...shadows.sm,
        },
        optionActive: {
          borderColor: c.primary,
          backgroundColor: `${c.primary}0d`,
        },
        optionLabel: {
          flex: 1,
          fontSize: typography.base,
          color: c.text,
          marginLeft: spacing.md,
        },
        optionLabelActive: { fontWeight: "600", color: c.primaryDark },
        radio: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: c.border,
          alignItems: "center",
          justifyContent: "center",
        },
        radioActive: { borderColor: c.primary },
        radioDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: c.primary,
        },
      }),
    [c],
  );

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
            <Text
              style={[styles.optionLabel, active && styles.optionLabelActive]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
