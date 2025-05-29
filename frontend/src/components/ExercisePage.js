import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Button,
  Form,
  Card,
  ProgressBar,
  Alert,
  Spinner,
  Modal,
} from "react-bootstrap";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import axios from "axios";
import "../styles/scss/main.scss";
import { useRef } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

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
  const [categories, setCategories] = useState([]);
  const exerciseRef = useRef(null);
  const { getAccessToken, isInitialized, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalExercises: 0,
    averageAccuracy: 0,
    averageAttempts: 0,
    totalTimeSpent: 0,
  });
  const [startTime, setStartTime] = useState(Date.now());
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [bestTime] = useState(null);
  const timerRef = useRef(null);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [isRetrying, setIsRetrying] = useState(false);

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

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/categories/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setCategories(response.data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchCategories();
    fetchExercises();
  }, [
    isInitialized,
    isAuthenticated,
    fetchExercises,
    fetchCategories,
    navigate,
  ]);

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

  useEffect(() => {
    if (isTimedMode) {
      // Set initial time to 5 minutes (300 seconds) plus 30 seconds per exercise
      const baseTime = 300; // 5 minutes
      const timePerExercise = 30; // 30 seconds per exercise
      const totalTime = baseTime + exercises.length * timePerExercise;
      setTimeRemaining(totalTime);

      // Start the timer
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            clearInterval(timerRef.current);
            setShowStats(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear timer if timed mode is disabled
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimedMode, exercises.length]);

  const handleRetry = () => {
    setIsRetrying(true);
    // Reset the current exercise's progress
    const updatedProgress = [...progress];
    updatedProgress[currentExerciseIndex] = {
      exerciseId: exercises[currentExerciseIndex].id,
      correct: false,
      attempts: 0,
      status: "not_started",
    };
    setProgress(updatedProgress);

    // Reset the user's answer to the saved answer or initial state
    setUserAnswer(
      savedAnswers[exercises[currentExerciseIndex].id] ||
        initializeAnswer(exercises[currentExerciseIndex])
    );

    setShowCorrection(false);
    setExplanation("");
    setIsRetrying(false);
  };

  const handleSubmit = async () => {
    try {
      const currentExercise = exercises[currentExerciseIndex];

      // Save the current answer before submitting
      setSavedAnswers((prev) => ({
        ...prev,
        [currentExercise.id]: userAnswer,
      }));

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

      // Update streak
      if (response.data.correct) {
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      // Update stats
      const correctAnswers = updated.filter((p) => p.correct).length;
      const totalAttempts = updated.reduce((sum, p) => sum + p.attempts, 0);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      setStats({
        totalCompleted: correctAnswers,
        totalExercises: exercises.length,
        averageAccuracy: (correctAnswers / exercises.length) * 100,
        averageAttempts: totalAttempts / exercises.length,
        totalTimeSpent: timeSpent,
      });

      // Show stats if all exercises are completed
      if (correctAnswers === exercises.length) {
        // Stop the timer if all exercises are completed
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setShowStats(true);
      }
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

        {showStats && (
          <Alert variant="success" className="exercise-finish-alert">
            <div className="d-flex align-items-center">
              <div className="me-3">
                <span className="finish-icon">🎉</span>
              </div>
              <div>
                <h4 className="mb-1">Congratulations!</h4>
                <p className="mb-0">
                  You've completed all exercises! Review your stats below or
                  start a new session.
                </p>
              </div>
            </div>
          </Alert>
        )}

        <div className="exercise-controls">
          <Form.Check
            type="switch"
            id="timed-mode"
            label="Timed Mode"
            checked={isTimedMode}
            onChange={(e) => setIsTimedMode(e.target.checked)}
            className="timed-mode-toggle"
          />
          {isTimedMode && (
            <div className="timer-display">
              Time Remaining: {formatTime(timeRemaining)}
              {bestTime && (
                <div className="best-time">
                  Best Time: {formatTime(bestTime)}
                </div>
              )}
            </div>
          )}
        </div>

        {streak > 0 && (
          <Alert variant="success" className="streak-alert">
            🔥 You've completed {streak} exercises in a row — keep it up!
          </Alert>
        )}

        <div className="two-column-layout">
          <div className="column-main">
            <Card className="exercise-card">
              <Card.Header className="exercise-header">
                <div className="filter-controls">
                  <Form.Group className="mb-3">
                    <Form.Label>Type</Form.Label>
                    <Form.Select
                      value={filters.type}
                      onChange={(e) =>
                        setFilters({ ...filters, type: e.target.value })
                      }
                    >
                      <option value="">All Types</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="drag-and-drop">Drag and Drop</option>
                      <option value="budget-allocation">
                        Budget Allocation
                      </option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      value={filters.category}
                      onChange={(e) =>
                        setFilters({ ...filters, category: e.target.value })
                      }
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Difficulty</Form.Label>
                    <Form.Select
                      value={filters.difficulty}
                      onChange={(e) =>
                        setFilters({ ...filters, difficulty: e.target.value })
                      }
                    >
                      <option value="">All Difficulties</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </Form.Select>
                  </Form.Group>
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

                        {!progress[currentExerciseIndex]?.correct && (
                          <Button
                            className="btn-retry btn-3d"
                            onClick={handleRetry}
                            disabled={isRetrying}
                          >
                            {isRetrying ? "Retrying..." : "Try Again"}
                          </Button>
                        )}

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

        <Modal
          show={showStats}
          onHide={() => setShowStats(false)}
          className="stats-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <div className="d-flex align-items-center">
                <span className="me-2">🏆</span>
                Exercise Session Summary
              </div>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="stats-grid">
              <div className="stat-item highlight">
                <h4>Total Completed</h4>
                <p>
                  {stats.totalCompleted} of {stats.totalExercises}
                </p>
              </div>
              <div className="stat-item">
                <h4>Average Accuracy</h4>
                <p>{stats.averageAccuracy.toFixed(1)}%</p>
              </div>
              <div className="stat-item">
                <h4>Average Attempts</h4>
                <p>{stats.averageAttempts.toFixed(1)} per question</p>
              </div>
              <div className="stat-item">
                <h4>Total Time Spent</h4>
                <p>
                  {Math.floor(stats.totalTimeSpent / 60)}m{" "}
                  {stats.totalTimeSpent % 60}s
                </p>
              </div>
              {isTimedMode && (
                <div className="stat-item">
                  <h4>Time Remaining</h4>
                  <p>{formatTime(timeRemaining)}</p>
                  {bestTime && (
                    <p className="best-time">
                      Best Time: {formatTime(bestTime)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowStats(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              className="btn-accent"
              onClick={() => {
                setShowStats(false);
                setCurrentExerciseIndex(0);
                setProgress([]);
                setStreak(0);
                setStartTime(Date.now());
                if (isTimedMode) {
                  const baseTime = 300;
                  const timePerExercise = 30;
                  setTimeRemaining(
                    baseTime + exercises.length * timePerExercise
                  );
                }
              }}
            >
              Start New Session
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default ExercisePage;
