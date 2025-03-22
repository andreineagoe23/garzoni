import React, { useState } from "react";
import axios from "axios";
import "../styles/scss/main.scss";

const BudgetAllocationExercise = ({
  data,
  exerciseId,
  onComplete,
  isCompleted,
}) => {
  const [allocations, setAllocations] = useState({});
  const [feedback, setFeedback] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");

  const { question, categories, total } = data;

  const handleChange = (category, value) => {
    if (value === "") {
      setAllocations((prev) => ({ ...prev, [category]: "" }));
    } else {
      const numericValue = parseInt(value, 10);
      if (!isNaN(numericValue)) {
        setAllocations((prev) => ({
          ...prev,
          [category]: numericValue.toString(),
        }));
      }
    }
  };

  const handleSubmit = async () => {
    const currentTotal = Object.values(allocations).reduce(
      (sum, val) => sum + (val ? parseInt(val, 10) : 0),
      0
    );

    if (currentTotal === total) {
      setFeedback("Great job! Your budget allocation is correct!");
      setFeedbackClass("correct");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("Error saving progress. Please try again.");
        setFeedbackClass("incorrect");
      }
    } else {
      setFeedback(`Your total must be ${total}. Current total: ${currentTotal}`);
      setFeedbackClass("incorrect");
    }
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      setAllocations({});
      setFeedback("");
      setFeedbackClass("");
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <div className="drag-drop-exercise-container">
      <h3 className="drag-drop-exercise-title">{question}</h3>
      <div className="budget-allocation-grid">
        {categories?.map((category) => (
          <div key={category} className="budget-allocation-item">
            <label className="budget-allocation-label">{category}</label>
            <input
              type="number"
              min="0"
              step="1"
              value={allocations[category] ?? ""}
              onChange={(e) => {
                const rawValue = e.target.value;
                const sanitizedValue = rawValue.replace(/[^0-9]/g, '');
                handleChange(category, sanitizedValue);
              }}
              disabled={isCompleted}
              className="budget-allocation-input"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div className="budget-total-display">
        <span>Current Total: ${Object.values(allocations).reduce((sum, val) => sum + (val ? parseInt(val, 10) : 0), 0)}</span>
        <span>Target: ${total}</span>
      </div>

      {isCompleted ? (
        <button className="btn btn-outline-accent" onClick={handleRetry}>
          Retry Exercise
        </button>
      ) : (
        <button className="btn btn-accent" onClick={handleSubmit}>
          Submit Allocation
        </button>
      )}

      {feedback && (
        <div className={`drag-drop-exercise-feedback drag-drop-exercise-feedback-${feedbackClass}`}>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default BudgetAllocationExercise;