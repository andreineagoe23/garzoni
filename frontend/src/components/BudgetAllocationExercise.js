import React, { useState } from "react";
import styles from "../styles/Exercise.module.css";
import axios from "axios";

const BudgetAllocationExercise = ({
  data,
  exerciseId,
  onComplete,
  isCompleted,
}) => {
  const [allocations, setAllocations] = useState({});
  const [feedback, setFeedback] = useState("");

  const { question, categories, total } = data;

  const handleChange = (category, value) => {
    setAllocations((prev) => ({
      ...prev,
      [category]: Math.max(0, parseInt(value) || 0),
    }));
  };

  const handleSubmit = async () => {
    const currentTotal = Object.values(allocations).reduce(
      (sum, val) => sum + val,
      0
    );

    if (currentTotal === total) {
      setFeedback("✅ Correct allocation!");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("❌ Error saving progress");
      }
    } else {
      setFeedback(`❌ Total must be ${total}. Current: ${currentTotal}`);
    }
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        { withCredentials: true }
      );
      setAllocations({});
      setFeedback("");
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <div className={styles.exerciseContainer}>
      <h3>{question}</h3>
      <div className={styles.allocationGrid}>
        {categories?.map((category) => (
          <div key={category} className={styles.allocationItem}>
            <label>{category}</label>
            <input
              type="number"
              min="0"
              value={allocations[category] || 0}
              onChange={(e) => handleChange(category, e.target.value)}
              disabled={isCompleted}
            />
          </div>
        ))}
      </div>

      <button className={styles.submitButton} onClick={handleSubmit} disabled={isCompleted}>
        Submit Allocation
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

export default BudgetAllocationExercise;
