import React, { useState, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import axios from "axios";
import styles from "../styles/DragAndDropExercise.module.css";

const DragAndDropExercise = ({ data, exerciseId }) => {
  const { items, targets } = data;

  // States for tracking answers and feedback
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");
  const [updatedTargets, setUpdatedTargets] = useState(targets);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const fetchExerciseProgress = async () => {
      try {
        if (!exerciseId) {
          console.error("Exercise ID is undefined.");
          return;
        }

        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/exercises/progress/${exerciseId}/`,
          { withCredentials: true }
        );

        if (response.data.completed) {
          setUserAnswers(response.data.answers);
          setIsCompleted(true);
        }
      } catch (error) {
        console.error("Error fetching exercise progress:", error);
      }
    };

    fetchExerciseProgress();
  }, [exerciseId]);

  const handleDrop = (target, item) => {
    setUserAnswers((prevAnswers) => ({
      ...prevAnswers,
      [target.id]: item.id,
    }));
  };

  const handleSubmit = async () => {
    let correct = 0;

    const newTargets = updatedTargets.map((target) => {
      const isCorrect = userAnswers[target.id] === target.id;
      if (isCorrect) {
        correct++;
      }
      return {
        ...target,
        isCorrect,
        droppedColor: isCorrect ? "#4caf50" : "#f44336",
      };
    });

    setFeedbackClass(
      correct === updatedTargets.length ? "correct" : "incorrect"
    );

    if (correct === updatedTargets.length) {
      setFeedback("You completed the exercise!");
      setIsCompleted(true);

      try {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/lessons/complete/`,
          { lesson_id: exerciseId },
          { withCredentials: true }
        );
      } catch (error) {
        console.error("Error saving exercise progress:", error);
      }
    } else {
      setFeedback("Try Again!");
    }

    setFeedback(
      `${correct} out of ${updatedTargets.length} answers are correct.`
    );
    setUpdatedTargets(newTargets);
  };
  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        { withCredentials: true }
      );
      setUserAnswers({});
      setFeedback("");
      setFeedbackClass("");
      setUpdatedTargets(targets.map((t) => ({ ...t, droppedColor: null })));
      setIsCompleted(false);
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.exerciseContainer}>
        <div className={styles.itemsContainer}>
          {items.map((item) => (
            <DraggableItem key={item.id} item={item} />
          ))}
        </div>
        <div className={styles.targetsContainer}>
          {updatedTargets.map((target) => (
            <DroppableTarget
              key={target.id}
              target={target}
              onDrop={handleDrop}
              droppedColor={target.droppedColor}
              userAnswer={userAnswers[target.id]}
            />
          ))}
        </div>
        {isCompleted ? (
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry Exercise
          </button>
        ) : (
          <button className={styles.submitButton} onClick={handleSubmit}>
            Submit Answers
          </button>
        )}
        {feedback && (
          <p className={`${styles.feedback} ${feedbackClass}`}>{feedback}</p>
        )}
      </div>
    </DndProvider>
  );
};

const DraggableItem = ({ item }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "ITEM",
    item: { id: item.id, text: item.text, color: item.color },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`${styles.draggableItem} ${isDragging ? styles.dragging : ""}`}
      style={{ backgroundColor: item.color }}
    >
      {item.text}
    </div>
  );
};

const DroppableTarget = ({ target, onDrop, droppedColor, userAnswer }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "ITEM",
    drop: (item) => onDrop(target, item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`${styles.droppableTarget} ${isOver ? styles.over : ""} ${
        droppedColor ? "dropped" : ""
      }`}
      style={{ backgroundColor: droppedColor }}
    >
      {target.text}
      {userAnswer && (
        <div className={styles.droppedItem}>Answer: {userAnswer}</div>
      )}
    </div>
  );
};

export default DragAndDropExercise;
