import React from "react";
import { Text, View, StyleSheet } from "react-native";
import MultipleChoice from "../exercises/MultipleChoice";
import BudgetAllocation from "../exercises/BudgetAllocation";
import FillInTable from "../exercises/FillInTable";
import ScenarioSimulation from "../exercises/ScenarioSimulation";
import DragAndDrop from "../exercises/DragAndDrop";
import { colors, spacing, typography } from "../../theme/tokens";

type ExerciseSectionProps = {
  exerciseType?: string;
  exerciseData?: Record<string, unknown>;
  exerciseId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
};

export default function ExerciseSection({
  exerciseType,
  exerciseData,
  exerciseId,
  isCompleted,
  disabled,
  onAttempt,
  onComplete,
}: ExerciseSectionProps) {
  const props = {
    data: exerciseData ?? {},
    exerciseId,
    isCompleted,
    disabled,
    onAttempt,
    onComplete,
  };

  switch (exerciseType) {
    case "multiple-choice":
      return <MultipleChoice {...props} />;
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

const styles = StyleSheet.create({
  unsupported: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceOffset,
    borderRadius: 10,
  },
  unsupportedText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
});
