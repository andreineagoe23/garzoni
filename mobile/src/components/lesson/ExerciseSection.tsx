import React, { useMemo } from "react";
import { Text, View, StyleSheet } from "react-native";
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
  const styles = useMemo(() => createUnsupportedStyles(c), [c]);

  const props = {
    data: exerciseData ?? {},
    exerciseId,
    sectionId,
    isCompleted,
    disabled,
    onAttempt,
    onComplete,
    gradingMode,
    hintsUsed,
    onStandaloneSubmitResult,
  };

  switch (exerciseType) {
    case "multiple-choice":
      return <MultipleChoice {...props} />;
    case "numeric":
      return <NumericInput {...props} />;
    case "budget-allocation":
      return <BudgetAllocation {...props} />;
    case "fill-in-table":
      return <FillInTable {...props} />;
    case "scenario-simulation":
      return <ScenarioSimulation {...props} />;
    case "drag-and-drop":
      return <DragAndDrop {...props} />;
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
