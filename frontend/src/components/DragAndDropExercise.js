import React, { useState, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import axios from "axios";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

const DragAndDropExercise = ({ data, exerciseId }) => {
  const { items, targets } = data;

  // States for tracking answers and feedback
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");
  const [updatedTargets, setUpdatedTargets] = useState(targets);
  const [isCompleted, setIsCompleted] = useState(false);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchExerciseProgress = async () => {
      try {
        if (!exerciseId) {
          console.error("Exercise ID is undefined.");
          return;
        }

        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/exercises/progress/${exerciseId}/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
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
  }, [exerciseId, getAccessToken]);

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
        droppedColor: isCorrect
          ? "rgba(76, 175, 80, 0.2)"
          : "rgba(244, 67, 54, 0.2)",
        animation: isCorrect ? "pulse-success" : "shake",
      };
    });

    setFeedbackClass(
      correct === updatedTargets.length ? "correct" : "incorrect"
    );

    if (correct === updatedTargets.length) {
      setFeedback("Great job! You completed the exercise!");
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
        `${correct} out of ${updatedTargets.length} answers are correct. Try again!`
      );
    }

    setUpdatedTargets(newTargets);
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
      setFeedback("");
      setFeedbackClass("");
      setUpdatedTargets(
        targets.map((t) => ({ ...t, droppedColor: null, animation: null }))
      );
      setIsCompleted(false);
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="drag-drop-exercise-container">
        <h3 className="drag-drop-exercise-title">Match The Correct Items</h3>
        <div className="drag-drop-exercise-items-container">
          {items.map((item) => (
            <DraggableItem key={item.id} item={item} />
          ))}
        </div>
        <div className="drag-drop-exercise-targets-container">
          {updatedTargets.map((target) => (
            <DroppableTarget
              key={target.id}
              target={target}
              onDrop={handleDrop}
              droppedColor={target.droppedColor}
              userAnswer={userAnswers[target.id]}
              animation={target.animation}
            />
          ))}
        </div>
        {isCompleted ? (
          <button className="btn btn-outline-accent" onClick={handleRetry}>
            Retry Exercise
          </button>
        ) : (
          <button className="btn btn-accent" onClick={handleSubmit}>
            Submit Answers
          </button>
        )}
        {feedback && (
          <div
            className={`drag-drop-exercise-feedback ${
              feedbackClass
                ? `drag-drop-exercise-feedback-${feedbackClass}`
                : ""
            }`}
          >
            {feedback}
          </div>
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
      className={`drag-drop-exercise-draggable-item ${
        isDragging ? "dragging" : ""
      }`}
      style={{ backgroundColor: item.color }}
    >
      {item.text}
    </div>
  );
};

const DroppableTarget = ({
  target,
  onDrop,
  droppedColor,
  userAnswer,
  animation,
}) => {
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
      className={`drag-drop-exercise-droppable-target ${isOver ? "over" : ""} ${
        droppedColor ? "dropped" : ""
      } ${animation ? animation : ""}`}
      style={{ backgroundColor: droppedColor }}
    >
      <div className="target-text">{target.text}</div>
      {userAnswer && (
        <div className="drag-drop-exercise-dropped-item">
          Answer: {userAnswer}
        </div>
      )}
    </div>
  );
};

export default DragAndDropExercise;
