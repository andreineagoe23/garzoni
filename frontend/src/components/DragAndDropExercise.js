import React, { useState, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import styles from "../styles/DragAndDropExercise.module.css";

const DragAndDropExercise = ({ data, exerciseId }) => {
  const { items, targets } = data;

  // States for tracking answers and feedback
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");
  const [updatedTargets, setUpdatedTargets] = useState(targets);
  const [isCompleted, setIsCompleted] = useState(false);

  // Load saved answers from localStorage when component mounts
  useEffect(() => {
    const savedAnswers = localStorage.getItem(`exercise-${exerciseId}`);
    if (savedAnswers) {
      const parsedAnswers = JSON.parse(savedAnswers);
      setUserAnswers(parsedAnswers.answers);
      setIsCompleted(parsedAnswers.completed);
    }
  }, [exerciseId]);

  // Handle item drop on a target
  const handleDrop = (target, item) => {
    setUserAnswers((prevAnswers) => ({
      ...prevAnswers,
      [target.id]: item.id,
    }));
  };

  // Handle submit and validate answers
  const handleSubmit = () => {
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

    setFeedbackClass(correct === updatedTargets.length ? "correct" : "incorrect");

    if (correct === updatedTargets.length) {
      setFeedback("You completed the exercise!");
      setIsCompleted(true);
      localStorage.setItem(
        `exercise-${exerciseId}`,
        JSON.stringify({ answers: userAnswers, completed: true })
      );
    } else {
      setFeedback("Try Again!");
    }

    setFeedback(`${correct} out of ${updatedTargets.length} answers are correct.`);
    setUpdatedTargets(newTargets);
  };

  // Clear answers and allow retry
  const handleRetry = () => {
    setUserAnswers({});
    setFeedback("");
    setFeedbackClass("");
    setUpdatedTargets(targets.map((target) => ({ ...target, droppedColor: null })));
    setIsCompleted(false);
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
        {!isCompleted ? (
          <button className={styles.submitButton} onClick={handleSubmit}>
            Submit Answers
          </button>
        ) : (
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry Exercise
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
