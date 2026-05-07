import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { apiClient, queryKeys, type MascotSituation } from "@garzoni/core";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui";
import MascotWithMessage from "../components/common/MascotWithMessage";
import { useThemeColors } from "../theme/ThemeContext";
import { spacing, typography, radius } from "../theme/tokens";

export type CheckpointQuizRow = {
  id: number;
  title: string;
  question: string;
  choices: { text: string }[];
  correct_answer: string;
  is_completed?: boolean;
};

type Props = {
  visible: boolean;
  quizzes: CheckpointQuizRow[];
  /** Used to refresh lesson/section completion flags after a checkpoint answer. */
  courseId: number;
  onDone: () => void;
};

export default function LessonCheckpointModal({
  visible,
  quizzes,
  courseId,
  onDone,
}: Props) {
  const { t } = useTranslation("common");
  const theme = useThemeColors();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active = useMemo(() => quizzes[index] ?? null, [quizzes, index]);

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      setSelected(null);
      setFeedback("");
      setCorrect(null);
      setSubmitting(false);
      return;
    }
    setIndex(0);
    setSelected(null);
    setFeedback("");
    setCorrect(null);
    setSubmitting(false);
  }, [visible, quizzes]);

  const situation = useMemo((): MascotSituation | undefined => {
    if (correct === true) return "quiz_correct";
    if (correct === false) return "quiz_incorrect";
    return undefined;
  }, [correct]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.progressSummary(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recentActivity(),
    });
    if (Number.isFinite(courseId) && courseId > 0) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonsWithProgress(courseId),
      });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths() });
    void queryClient.invalidateQueries({ queryKey: ["learningPathCourses"] });
  }, [courseId, queryClient]);

  const submit = useCallback(async () => {
    if (!active || submitting) return;
    if (selected == null) {
      setCorrect(null);
      setFeedback(t("shared.pleaseSelectAnswer"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiClient.post("/quizzes/complete/", {
        quiz_id: active.id,
        selected_answer: selected,
      });
      const ok = Boolean(response.data?.correct);
      const already = Boolean(response.data?.already_completed);
      setFeedback(String(response.data?.message ?? ""));
      setCorrect(ok || already ? true : false);
      if (ok || already) {
        invalidate();
        const next = index + 1;
        if (next >= quizzes.length) {
          onDone();
        } else {
          setIndex(next);
          setSelected(null);
          setFeedback("");
          setCorrect(null);
        }
      } else {
        setSelected(null);
      }
    } catch {
      setCorrect(false);
      setFeedback(t("shared.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }, [
    active,
    index,
    invalidate,
    onDone,
    quizzes.length,
    selected,
    submitting,
    t,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: theme.overlay,
          justifyContent: "center",
          padding: spacing.xl,
        },
        card: {
          backgroundColor: theme.surface,
          borderRadius: radius.xl,
          padding: spacing.xl,
          maxHeight: "88%",
        },
        label: {
          fontSize: typography.xs,
          fontWeight: "700",
          color: theme.textMuted,
          textAlign: "center",
          textTransform: "uppercase",
        },
        title: {
          fontSize: typography.xl,
          fontWeight: "800",
          color: theme.text,
          textAlign: "center",
          marginTop: spacing.sm,
        },
        subtitle: {
          fontSize: typography.sm,
          color: theme.textMuted,
          textAlign: "center",
          marginTop: spacing.xs,
        },
        qTitle: {
          fontSize: typography.lg,
          fontWeight: "700",
          color: theme.text,
          marginTop: spacing.lg,
        },
        qBody: {
          fontSize: typography.base,
          color: theme.text,
          marginTop: spacing.sm,
        },
        choice: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginTop: spacing.sm,
        },
        choiceOn: {
          borderColor: theme.accent,
          backgroundColor: `${theme.accent}18`,
        },
        choiceText: {
          fontSize: typography.sm,
          fontWeight: "600",
          color: theme.text,
        },
        closeBtn: {
          position: "absolute",
          right: spacing.sm,
          top: spacing.sm,
          zIndex: 2,
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        closeBtnText: {
          fontSize: 26,
          fontWeight: "300",
          color: theme.textMuted,
          lineHeight: 28,
        },
      }),
    [theme],
  );

  if (!visible || !quizzes.length) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={submitting ? undefined : onDone}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { position: "relative" }]}>
          <Pressable
            onPress={submitting ? undefined : onDone}
            disabled={submitting}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("courses.flow.checkpointDismissAria")}
          >
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>
              {t("courses.flow.checkpointProgress", {
                current: Math.min(index + 1, quizzes.length),
                total: quizzes.length,
              })}
            </Text>
            <Text style={styles.title}>
              {t("courses.flow.checkpointTitle")}
            </Text>
            <Text style={styles.subtitle}>
              {t("courses.flow.checkpointSubtitle")}
            </Text>

            {active ? (
              <>
                <Text style={styles.qTitle}>{active.title}</Text>
                <Text style={styles.qBody}>{active.question}</Text>
                {active.choices.map((c, i) => (
                  <Pressable
                    key={`${active.id}-${c.text}-${i}`}
                    onPress={() => !submitting && setSelected(c.text)}
                    disabled={submitting}
                    style={[
                      styles.choice,
                      selected === c.text ? styles.choiceOn : null,
                    ]}
                  >
                    <Text style={styles.choiceText}>{c.text}</Text>
                  </Pressable>
                ))}
                <View style={{ marginTop: spacing.lg }}>
                  <Button disabled={submitting} onPress={() => void submit()}>
                    {t("courses.quiz.submitAnswer")}
                  </Button>
                </View>
                {feedback ? (
                  <View style={{ marginTop: spacing.md }}>
                    <MascotWithMessage
                      mood={
                        correct === true
                          ? "celebrate"
                          : correct === false
                            ? "encourage"
                            : "neutral"
                      }
                      situation={situation}
                      customMessage={feedback}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
