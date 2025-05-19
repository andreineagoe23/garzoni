import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Button,
  Form,
  Card,
  ProgressBar,
  Alert,
  Spinner,
} from "react-bootstrap";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import axios from "axios";
import "../styles/scss/main.scss";
import { useRef } from "react";
import { useAuth } from "./AuthContext";

const ExercisePage = () => {
  const [exercises, setExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState(null);
  const [progress, setProgress] = useState([]);
  const [showCorrection, setShowCorrection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    difficulty: "",
  });
  const exerciseRef = useRef(null);
  const { getAccessToken } = useAuth();

  const fetchExercises = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.category) params.append("category", filters.category);
      if (filters.difficulty) params.append("difficulty", filters.difficulty);

      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/`,
        {
          params,
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      const validatedExercises = response.data.filter(
        (exercise) =>
          exercise.question &&
          exercise.type &&
          exercise.exercise_data &&
          ((exercise.type === "multiple-choice" &&
            Array.isArray(exercise.exercise_data.options)) ||
            (exercise.type === "drag-and-drop" &&
              Array.isArray(exercise.exercise_data.items)) ||
            (exercise.type === "budget-allocation" &&
              Array.isArray(exercise.exercise_data.categories)))
      );

      setExercises(validatedExercises);
      setLoading(false);
    } catch (err) {
      setError("Failed to load exercises. Please try again later.");
      setLoading(false);
    }
  }, [filters, getAccessToken]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const initializeAnswer = (exercise) => {
    if (!exercise) return null;

    switch (exercise.type) {
      case "drag-and-drop":
        return exercise.exercise_data.items.map((_, index) => index);
      case "budget-allocation":
        return exercise.exercise_data.categories.reduce((acc, category) => {
          acc[category] = 0;
          return acc;
        }, {});
      default:
        return null;
    }
  };

  useEffect(() => {
    if (exercises.length > 0) {
      setUserAnswer(initializeAnswer(exercises[currentExerciseIndex]));
    }
  }, [exercises, currentExerciseIndex]);

  const handleSubmit = async () => {
    try {
      const currentExercise = exercises[currentExerciseIndex];
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/${currentExercise.id}/submit/`,
        { user_answer: userAnswer },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      const updated = [...progress];
      updated[currentExerciseIndex] = {
        exerciseId: currentExercise.id,
        correct: response.data.correct,
        attempts: response.data.attempts,
        status: response.data.correct ? "completed" : "attempted",
      };

      setProgress(updated);
      setExplanation(response.data.explanation || "");
      setShowCorrection(true);
    } catch (err) {
      setError("Submission failed. Please try again.");
    }
  };

  const handleNext = () => {
    setShowCorrection(false);
    setExplanation("");
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
    }
  };

  const renderExercise = () => {
    const exercise = exercises[currentExerciseIndex];
    if (!exercise || !exercise.exercise_data) {
      return <div className="exercise-error">Invalid exercise format</div>;
    }

    switch (exercise.type) {
      case "multiple-choice":
        return (
          <div className="exercise-content multiple-choice">
            <h3 className="exercise-question">{exercise.question}</h3>
            <div className="option-list">
              {exercise.exercise_data.options.map((option, index) => (
                <div key={index} className="option-item">
                  <Form.Check
                    type="radio"
                    id={`option-${index}`}
                    name="exercise-options"
                    label={option}
                    checked={userAnswer === index}
                    onChange={() => setUserAnswer(index)}
                    className="option-check"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case "drag-and-drop":
        if (!Array.isArray(userAnswer)) {
          return (
            <div className="exercise-error">
              Error: drag-and-drop answer format invalid.
            </div>
          );
        }
        return (
          <div className="exercise-content drag-drop">
            <h3 className="exercise-question">{exercise.question}</h3>
            <div className="drag-items">
              {userAnswer.map((itemIndex, index) => {
                const item = exercise.exercise_data.items[itemIndex];
                return (
                  <div
                    key={index}
                    className="drag-item"
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", index)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const fromIndex = parseInt(
                        e.dataTransfer.getData("text/plain")
                      );
                      const newOrder = [...userAnswer];
                      [newOrder[fromIndex], newOrder[index]] = [
                        newOrder[index],
                        newOrder[fromIndex],
                      ];
                      setUserAnswer(newOrder);
                    }}
                  >
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "budget-allocation":
        return (
          <div className="exercise-content budget-allocation">
            <h3 className="exercise-question">{exercise.question}</h3>
            <div className="budget-categories">
              {exercise.exercise_data.categories.map((category, index) => (
                <div key={index} className="budget-category">
                  <Form.Label>{category}</Form.Label>
                  <Form.Control
                    type="number"
                    value={userAnswer[category] || 0}
                    onChange={(e) =>
                      setUserAnswer((prev) => ({
                        ...prev,
                        [category]: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="budget-input"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <div className="exercise-error">Unsupported exercise type</div>;
    }
  };

  if (loading) {
    return (
      <div className="page-content exercise-page">
        <Container>
          <div className="loading-container">
            <Spinner animation="border" role="status" className="spinner" />
            <p>Loading exercises...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content exercise-page">
        <Container>
          <Alert variant="danger" className="error-alert">
            {error}
            <div className="mt-3">
              <Button className="btn-accent" onClick={fetchExercises}>
                Retry
              </Button>
            </div>
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="page-content exercise-page">
      <Container>
        <div className="page-header">
          <h1 className="page-header-title">Financial Exercises</h1>
        </div>

        <div className="two-column-layout">
          <div className="column-main">
            <Card className="exercise-card">
              <Card.Header className="exercise-header">
                <div className="filter-controls">
                  <Form.Select
                    value={filters.type}
                    onChange={(e) =>
                      setFilters({ ...filters, type: e.target.value })
                    }
                    aria-label="Filter by exercise type"
                    className="filter-select"
                  >
                    <option value="">All Types</option>
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="drag-and-drop">Drag & Drop</option>
                    <option value="budget-allocation">Budget Allocation</option>
                  </Form.Select>

                  <Form.Select
                    value={filters.difficulty}
                    onChange={(e) =>
                      setFilters({ ...filters, difficulty: e.target.value })
                    }
                    aria-label="Filter by difficulty"
                    className="filter-select"
                  >
                    <option value="">All Difficulties</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Form.Select>
                </div>
              </Card.Header>

              <Card.Body className="exercise-body">
                <div className="progress-info">
                  <p className="exercise-count">
                    Exercise {currentExerciseIndex + 1} of {exercises.length}
                  </p>
                  <ProgressBar
                    now={Math.round(
                      ((currentExerciseIndex + 1) / exercises.length) * 100
                    )}
                    label={`${Math.round(
                      ((currentExerciseIndex + 1) / exercises.length) * 100
                    )}% Complete`}
                    className="exercise-progress"
                  />
                </div>

                <TransitionGroup component={null}>
                  <CSSTransition
                    key={currentExerciseIndex}
                    timeout={300}
                    classNames="fade"
                    nodeRef={exerciseRef}
                  >
                    <div ref={exerciseRef}>{renderExercise()}</div>
                  </CSSTransition>
                </TransitionGroup>

                {showCorrection && explanation && (
                  <Alert variant="info" className="mt-3">
                    💡 Explanation: {explanation}
                  </Alert>
                )}

                <div className="exercise-actions">
                  {showCorrection ? (
                    <div className="correction-container">
                      <Alert
                        variant={
                          progress[currentExerciseIndex]?.correct
                            ? "success"
                            : "danger"
                        }
                        className="correction-alert"
                      >
                        {progress[currentExerciseIndex]?.correct
                          ? "✅ Correct! Well done!"
                          : "❌ Incorrect. Better luck next time!"}
                      </Alert>

                      <div className="navigation-buttons">
                        <Button
                          className="btn-outline-accent btn-3d"
                          onClick={() => setCurrentExerciseIndex(0)}
                          disabled={currentExerciseIndex === 0}
                        >
                          Restart
                        </Button>

                        <Button
                          className="btn-accent btn-3d"
                          onClick={handleNext}
                        >
                          {currentExerciseIndex === exercises.length - 1
                            ? "Finish"
                            : "Next Exercise"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="btn-accent btn-3d submit-btn"
                      onClick={handleSubmit}
                    >
                      Submit Answer
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>

          <div className="column-side">
            <Card className="progress-card">
              <Card.Header>
                <h3 className="progress-title">Your Progress</h3>
              </Card.Header>
              <Card.Body>
                <div className="progress-list">
                  {exercises.map((_, index) => (
                    <div
                      key={index}
                      className={`progress-item ${
                        progress[index]?.correct
                          ? "correct"
                          : progress[index]
                          ? "incorrect"
                          : ""
                      }`}
                    >
                      <span className="exercise-label">
                        Exercise {index + 1}
                      </span>
                      <span className="status-text">
                        {progress[index]?.status === "completed"
                          ? "✅ Completed"
                          : progress[index]
                          ? "❌ Attempted"
                          : "⏳ Not started"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default ExercisePage;
