import React, { useState } from "react";
import styles from "../styles/Exercise.module.css";
import axios from "axios";

const MultipleChoiceExercise = ({
  data,
  exerciseId,
  onComplete,
  isCompleted,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");

  const { question, options, correctAnswer } = data;

  const handleSubmit = async () => {
    if (selectedAnswer === correctAnswer) {
      setFeedback("✅ Correct! Well done!");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("❌ Error saving progress");
      }
    } else {
      setFeedback("❌ Incorrect. Try again!");
    }
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        { withCredentials: true }
      );
      setSelectedAnswer(null);
      setFeedback("");
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <div className={styles.exerciseContainer}>
      <h3>{question}</h3>
      <div className={styles.optionsGrid}>
        {options?.map((option, index) => (
          <button
            key={index}
            className={`${styles.optionButton} ${
              selectedAnswer === index ? styles.selected : ""
            }`}
            onClick={() => !isCompleted && setSelectedAnswer(index)}
            disabled={isCompleted}
          >
            {option}
          </button>
        ))}
      </div>

      <button className={styles.submitButton} onClick={handleSubmit} disabled={isCompleted || selectedAnswer === null}>
        Submit Answer
      </button>

      {isCompleted && (
        <button className={styles.retryButton} onClick={handleRetry}>
          Retry Exercise
        </button>
      )}

      {feedback && <div className={styles.feedback}>{feedback}</div>}
    </div>
  );
};

export default MultipleChoiceExercise;
