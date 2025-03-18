import React, { useState } from "react";
import axios from "axios";
import "../styles/scss/main.scss";

const MultipleChoiceExercise = ({
  data,
  exerciseId,
  onComplete,
  isCompleted,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");

  const { question, options, correctAnswer } = data;

  const handleSubmit = async () => {
    if (selectedAnswer === correctAnswer) {
      setFeedback("Correct! Well done!");
      setFeedbackClass("correct");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("Error saving progress. Please try again.");
        setFeedbackClass("incorrect");
      }
    } else {
      setFeedback("Incorrect. Try again!");
      setFeedbackClass("incorrect");
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
      setFeedbackClass("");
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <div className="drag-drop-exercise-container">
      <h3 className="drag-drop-exercise-title">{question}</h3>
      <div className="multiple-choice-options-grid">
        {options?.map((option, index) => (
          <button
            key={index}
            className={`multiple-choice-option-button ${
              selectedAnswer === index ? "multiple-choice-selected" : ""
            }`}
            onClick={() => !isCompleted && setSelectedAnswer(index)}
            disabled={isCompleted}
          >
            {option}
          </button>
        ))}
      </div>

      {isCompleted ? (
        <button className="btn btn-outline-accent" onClick={handleRetry}>
          Retry Exercise
        </button>
      ) : (
        <button
          className="btn btn-accent"
          onClick={handleSubmit}
          disabled={selectedAnswer === null}
        >
          Submit Answer
        </button>
      )}

      {feedback && (
        <div
          className={`drag-drop-exercise-feedback drag-drop-exercise-feedback-${feedbackClass}`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};

export default MultipleChoiceExercise;
