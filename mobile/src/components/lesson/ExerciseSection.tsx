import React, { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { resetExercise } from "@garzoni/core";
import { AppText, Button } from "../ui";
import MultipleChoice from "../exercises/MultipleChoice";
import NumericInput from "../exercises/NumericInput";
import BudgetAllocation from "../exercises/BudgetAllocation";
import FillInTable from "../exercises/FillInTable";
import ScenarioSimulation from "../exercises/ScenarioSimulation";
import DragAndDrop from "../exercises/DragAndDrop";
import { spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

export type ExerciseGradingMode = "lesson" | "standalone";

export type StandaloneSubmitResult = {
  correct: boolean;
  feedback: string;
  xpDelta?: number;
};

type ExerciseSectionProps = {
  exerciseType?: string;
  exerciseData?: Record<string, unknown>;
  exerciseId?: string | number;
  /** LessonSection id when grading via catalog submit from lesson flow. */
  sectionId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
  /** Standalone practice tab: grade via POST /exercises/:id/submit/ like web. */
  gradingMode?: ExerciseGradingMode;
  hintsUsed?: number;
  onStandaloneSubmitResult?: (r: StandaloneSubmitResult) => void;
};

function createUnsupportedStyles(c: ThemeColors) {
  return StyleSheet.create({
    unsupported: {
      padding: spacing.lg,
      backgroundColor: c.surfaceOffset,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    unsupportedText: {
      fontSize: typography.sm,
      color: c.textMuted,
      textAlign: "center",
    },
    answeredFooter: {
      marginTop: spacing.md,
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    answeredNote: {
      fontSize: typography.sm,
      color: c.textMuted,
    },
  });
}

export default function ExerciseSection({
  exerciseType,
  exerciseData,
  exerciseId,
  sectionId,
  isCompleted,
  disabled,
  onAttempt,
  onComplete,
  gradingMode = "lesson",
  hintsUsed = 0,
  onStandaloneSubmitResult,
}: ExerciseSectionProps) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const styles = useMemo(() => createUnsupportedStyles(c), [c]);

  // Every widget locks its inputs on `isCompleted` and offers no way back.
  // The lesson flow marks a knowledge check complete when you press Continue
  // past it without answering, so on the next pass the options render at full
  // strength and silently swallow taps. Reopening is owned here rather than in
  // each of the six widgets: bumping `attempt` remounts the widget, which
  // clears its internal answer state and reshuffles the options.
  const [attempt, setAttempt] = useState(0);
  const [reopened, setReopened] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setReopened(false);
  }, [exerciseId, sectionId]);

  const locked = Boolean(isCompleted) && !reopened;

  const handleRetry = async () => {
    if (retrying) return;
    if (gradingMode === "standalone" && exerciseId != null) {
      setRetrying(true);
      try {
        await resetExercise({ exercise_id: exerciseId });
      } catch {
        // A skipped check has no UserExerciseProgress row to clear, and that
        // 404 must not keep the learner locked out. Reopen either way.
      } finally {
        setRetrying(false);
      }
    }
    setReopened(true);
    setAttempt((n) => n + 1);
  };

  const props = {
    data: exerciseData ?? {},
    exerciseId,
    sectionId,
    isCompleted: locked,
    disabled,
    onAttempt,
    onComplete,
    gradingMode,
    hintsUsed,
    onStandaloneSubmitResult,
  };

  const withRetry = (widget: React.ReactNode) => (
    <View>
      {/* Keyed on `attempt` so Try Again remounts the widget rather than
          relying on each one to expose a reset of its own. */}
      <View key={attempt}>{widget}</View>
      {locked && !disabled ? (
        <View style={styles.answeredFooter}>
          <AppText style={styles.answeredNote}>
            {t("exercises.widgets.alreadyAnswered")}
          </AppText>
          <Button
            size="sm"
            variant="secondary"
            loading={retrying}
            onPress={() => void handleRetry()}
          >
            {t("exercises.actions.tryAgain")}
          </Button>
        </View>
      ) : null}
    </View>
  );

  switch (exerciseType) {
    case "multiple-choice":
      return withRetry(<MultipleChoice {...props} />);
    case "numeric":
      return withRetry(<NumericInput {...props} />);
    case "budget-allocation":
      return withRetry(<BudgetAllocation {...props} />);
    case "fill-in-table":
      return withRetry(<FillInTable {...props} />);
    case "scenario-simulation":
      return withRetry(<ScenarioSimulation {...props} />);
    case "drag-and-drop":
      return withRetry(<DragAndDrop {...props} />);
    default:
      return (
        <View style={styles.unsupported}>
          <Text style={styles.unsupportedText}>
            Unsupported exercise type: {exerciseType ?? "unknown"}
          </Text>
        </View>
      );
  }
}
