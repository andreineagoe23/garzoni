import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

export type ExerciseIntentBannerModel =
  | {
      kind: "applied";
      skill: string;
      category: string;
      differsFromSkill: boolean;
    }
  | { kind: "unmapped"; skill: string };

type Props = {
  model: ExerciseIntentBannerModel;
  contextSubtitle?: string;
  onClearFilter: () => void;
  onDismiss: () => void;
  onChangeCategory: () => void;
};

/**
 * Dashboard → exercises bridge (parity with web ExerciseIntentBanner).
 */
export default function ExerciseSkillIntentBanner({
  model,
  contextSubtitle,
  onClearFilter,
  onDismiss,
  onChangeCategory,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  const title =
    model.kind === "applied"
      ? model.differsFromSkill
        ? t("exercises.skillIntent.titleMappedDiffers", {
            category: model.category,
            skill: model.skill,
          })
        : t("exercises.skillIntent.titleMapped", {
            category: model.category,
            skill: model.skill,
          })
      : t("exercises.skillIntent.titleUnmapped", { skill: model.skill });

  const body =
    model.kind === "applied"
      ? t("exercises.skillIntent.bodyMapped")
      : t("exercises.skillIntent.bodyUnmapped");

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: c.primary + "73",
          backgroundColor: c.primary + "1F",
        },
      ]}
      accessibilityLabel={t("exercises.skillIntent.regionLabel")}
    >
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {contextSubtitle ? (
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {contextSubtitle}
        </Text>
      ) : null}
      <Text style={[styles.body, { color: c.textMuted }]}>{body}</Text>
      <View style={styles.actions}>
        {model.kind === "applied" ? (
          <>
            <Pressable
              onPress={onChangeCategory}
              style={[styles.btn, { borderColor: c.border, backgroundColor: c.surface }]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: c.primary }]}>
                {t("exercises.skillIntent.changeCategory")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClearFilter}
              style={[styles.btn, { borderColor: c.border, backgroundColor: c.surface }]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: c.primary }]}>
                {t("exercises.skillIntent.clearFilter")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onChangeCategory}
            style={[styles.btn, { borderColor: c.border, backgroundColor: c.surface }]}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, { color: c.primary }]}>
              {t("exercises.skillIntent.changeCategory")}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={onDismiss} accessibilityRole="button">
          <Text style={[styles.dismiss, { color: c.textMuted }]}>
            {t("exercises.skillIntent.dismiss")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontSize: typography.sm, fontWeight: "700", lineHeight: 20 },
  sub: { fontSize: typography.xs, marginTop: spacing.xs, lineHeight: 18 },
  body: {
    fontSize: typography.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: typography.xs, fontWeight: "700" },
  dismiss: { fontSize: typography.xs, fontWeight: "600", marginLeft: spacing.xs },
});
