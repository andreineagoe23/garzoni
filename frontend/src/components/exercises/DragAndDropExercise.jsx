import React, { useEffect, useMemo, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const DragAndDropExercise = ({ data, exerciseId }) => {
  const { items = [], targets = [] } = data || {};
  const { getAccessToken } = useAuth();

  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null);
  const [targetStates, setTargetStates] = useState(() =>
    targets.map((target) => ({ ...target, status: null }))
  );
  const [isCompleted, setIsCompleted] = useState(false);

  const itemsById = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [items]);

  useEffect(() => {
    setTargetStates(targets.map((target) => ({ ...target, status: null })));
    setUserAnswers({});
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(false);
  }, [targets]);

  useEffect(() => {
    const fetchExerciseProgress = async () => {
      if (!exerciseId) return;
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/exercises/progress/${exerciseId}/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        if (response.data.completed) {
          const savedAnswers = response.data.answers || {};
          setUserAnswers(savedAnswers);
          setIsCompleted(true);
          setTargetStates(
            targets.map((target) => ({
              ...target,
              status: savedAnswers[target.id] === target.id ? "correct" : "incorrect",
            }))
          );
          setFeedback("This exercise is already completed.");
          setFeedbackType("success");
        }
      } catch (error) {
        console.error("Error fetching exercise progress:", error);
      }
    };

    fetchExerciseProgress();
  }, [exerciseId, getAccessToken, targets]);

  const handleDrop = (target, item) => {
    if (isCompleted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [target.id]: item.id,
    }));
  };

  const handleSubmit = async () => {
    const results = targets.map((target) => {
      const isCorrect = userAnswers[target.id] === target.id;
      return { ...target, status: isCorrect ? "correct" : "incorrect" };
    });

    const correctCount = results.filter((target) => target.status === "correct").length;

    if (correctCount === targets.length) {
      setFeedback("Great job! You completed the exercise!");
      setFeedbackType("success");
      setIsCompleted(true);

      try {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/lessons/complete/`,
          { lesson_id: exerciseId },
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
      } catch (error) {
        console.error("Error saving exercise progress:", error);
      }
    } else {
      setFeedback(
        `${correctCount} out of ${targets.length} answers are correct. Try again!`
      );
      setFeedbackType("error");
    }

    setTargetStates(results);
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setUserAnswers({});
      setTargetStates(targets.map((target) => ({ ...target, status: null })));
      setFeedback("");
      setFeedbackType(null);
      setIsCompleted(false);
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <GlassCard padding="lg" className="transition">
        <header className="space-y-2">
          <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
            Match The Correct Items
          </h3>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Drag each item to the matching target. Submit your answers when you are ready.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Items
            </h4>
            <div className="mt-3 flex flex-wrap gap-3">
              {items.map((item) => (
                <DraggableItem key={item.id} item={item} isDisabled={isCompleted} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Targets
            </h4>
            <div className="mt-3 grid gap-3">
              {targetStates.map((target) => (
                <DroppableTarget
                  key={target.id}
                  target={target}
                  status={target.status}
                  onDrop={handleDrop}
                  userAnswer={userAnswers[target.id]}
                  itemsById={itemsById}
                  isDisabled={isCompleted}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isCompleted ? (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              Retry Exercise
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              Submit Answers
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              feedbackType === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
            }`}
          >
            {feedback}
          </div>
        )}
      </GlassCard>
    </DndProvider>
  );
};

const DraggableItem = ({ item, isDisabled }) => {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: "EXERCISE_ITEM",
      item: { id: item.id },
      canDrag: () => !isDisabled,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [item, isDisabled]
  );

  return (
    <div
      ref={drag}
      className={`min-w-[140px] rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-3 text-sm font-semibold text-[color:var(--text-color,#111827)] shadow-sm transition ${
        isDragging ? "opacity-60" : "opacity-100"
      } ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-move hover:border-[color:var(--accent,#2563eb)]/40"}`}
      style={{
        backgroundColor: item.color || "var(--card-bg,#ffffff)",
      }}
    >
      {item.text}
    </div>
  );
};

const DroppableTarget = ({
  target,
  status,
  onDrop,
  userAnswer,
  itemsById,
  isDisabled,
}) => {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "EXERCISE_ITEM",
      canDrop: () => !isDisabled,
      drop: (item) => onDrop(target, item),
      collect: (monitor) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [target, onDrop, isDisabled]
  );

  const statusClasses =
    status === "correct"
      ? "border-emerald-500/60 bg-emerald-500/10"
      : status === "incorrect"
      ? "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
      : "border-dashed";

  return (
    <div
      ref={drop}
      className={`rounded-2xl border px-4 py-4 text-center shadow-inner transition ${
        isOver ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10" : statusClasses
      }`}
    >
      <p className="text-sm font-semibold text-[color:var(--accent,#111827)]">
        {target.text}
      </p>
      {userAnswer && (
        <div className="mt-3 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white px-3 py-2 text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
          Answer: {itemsById[userAnswer]?.text || userAnswer}
        </div>
      )}
    </div>
  );
};

export default DragAndDropExercise;
