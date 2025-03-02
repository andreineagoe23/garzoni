import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Button, Form, Card, ProgressBar, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import '../styles/ExercisePage.css';

const ExercisePage = () => {
  const [exercises, setExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState(null);
  const [progress, setProgress] = useState([]);
  const [showCorrection, setShowCorrection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    difficulty: ''
  });

  const fetchExercises = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.category) params.append('category', filters.category);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);

      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/`,
        { 
          params,
          withCredentials: true 
        }
      );
      
      // Validate exercise data structure
      const validatedExercises = response.data.filter(exercise => 
        exercise.question &&
        exercise.type &&
        exercise.exercise_data &&
        (
          (exercise.type === 'multiple-choice' && Array.isArray(exercise.exercise_data.options)) ||
          (exercise.type === 'drag-and-drop' && Array.isArray(exercise.exercise_data.items)) ||
          (exercise.type === 'budget-allocation' && Array.isArray(exercise.exercise_data.categories))
        )
      );
      
      setExercises(validatedExercises);
      setLoading(false);
    } catch (err) {
      setError('Failed to load exercises. Please try again later.');
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const initializeAnswer = (exercise) => {
    if (!exercise) return null;
    
    switch(exercise.type) {
      case 'drag-and-drop':
        return exercise.exercise_data.items.map((_, index) => index);
      case 'budget-allocation':
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
        { withCredentials: true }
      );

      setProgress([...progress, {
        exerciseId: currentExercise.id,
        correct: response.data.correct,
        attempts: response.data.attempts
      }]);

      setShowCorrection(true);
    } catch (err) {
      setError('Submission failed. Please try again.');
    }
  };

  const handleNext = () => {
    setShowCorrection(false);
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    }
  };

  const renderExercise = () => {
    const exercise = exercises[currentExerciseIndex];
    if (!exercise || !exercise.exercise_data) {
      return <Alert variant="danger">Invalid exercise format</Alert>;
    }

    try {
      switch (exercise.type) {
        case 'multiple-choice':
          return (
            <div className="multiple-choice">
              <h4 className="mb-4">{exercise.question}</h4>
              <div className="d-grid gap-2">
                {exercise.exercise_data.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={userAnswer === index ? 'primary' : 'outline-primary'}
                    onClick={() => setUserAnswer(index)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          );

        case 'drag-and-drop':
          return (
            <div className="drag-and-drop">
              <h4 className="mb-4">{exercise.question}</h4>
              <div className="d-flex flex-wrap gap-2">
                {userAnswer.map((itemIndex, index) => {
                  const item = exercise.exercise_data.items[itemIndex];
                  return (
                    <div
                      key={index}
                      className="drag-item p-2 border rounded"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                        const newOrder = [...userAnswer];
                        [newOrder[fromIndex], newOrder[index]] = [newOrder[index], newOrder[fromIndex]];
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

        case 'budget-allocation':
          return (
            <div className="budget-allocation">
              <h4 className="mb-4">{exercise.question}</h4>
              <Form>
                {exercise.exercise_data.categories.map((category, index) => (
                  <Form.Group key={index} className="mb-3">
                    <Form.Label>{category}</Form.Label>
                    <Form.Control 
                      type="number"
                      min="0"
                      value={userAnswer[category] || 0}
                      onChange={(e) => setUserAnswer(prev => ({
                        ...prev,
                        [category]: Math.max(0, parseInt(e.target.value) || 0)
                      }))}
                    />
                  </Form.Group>
                ))}
              </Form>
            </div>
          );

        default:
          return <Alert variant="warning">Unsupported exercise type</Alert>;
      }
    } catch (error) {
      console.error('Error rendering exercise:', error);
      return <Alert variant="danger">Error displaying this exercise</Alert>;
    }
  };

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading exercises...</span>
        </Spinner>
        <p className="mt-2">Loading exercises...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="text-center mt-5">
        <Alert variant="danger">{error}</Alert>
        <Button variant="primary" onClick={fetchExercises} className="mt-3">
          Retry
        </Button>
      </Container>
    );
  }

  if (exercises.length === 0) {
    return (
      <Container className="text-center mt-5">
        <Alert variant="info">No exercises found matching your filters</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-5 exercise-page">
      <Row className="mb-4">
        <Col>
          <h2>Financial Exercises</h2>
          <div className="filter-controls d-flex gap-2 flex-wrap">
            <Form.Select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              aria-label="Filter by exercise type"
            >
              <option value="">All Types</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="drag-and-drop">Drag & Drop</option>
              <option value="budget-allocation">Budget Allocation</option>
            </Form.Select>

            <Form.Select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              aria-label="Filter by difficulty"
            >
              <option value="">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Form.Select>
          </div>
        </Col>
      </Row>

      <Row>
        <Col lg={8}>
          <Card className="p-4 exercise-card shadow-sm">
            <div className="progress-indicator mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span>
                  Exercise {currentExerciseIndex + 1} of {exercises.length}
                </span>
                <span>
                  {Math.round(((currentExerciseIndex + 1) / exercises.length) * 100)}% Complete
                </span>
              </div>
              <ProgressBar 
                now={((currentExerciseIndex + 1) / exercises.length) * 100} 
                variant="success"
                animated
              />
            </div>

            {renderExercise()}

            {showCorrection ? (
              <div className="correction mt-4">
                <Alert variant={progress[currentExerciseIndex]?.correct ? 'success' : 'danger'}>
                  {progress[currentExerciseIndex]?.correct 
                    ? '✅ Correct! Well done!'
                    : '❌ Incorrect. Better luck next time!'}
                </Alert>
                <div className="d-flex justify-content-between">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setCurrentExerciseIndex(0)}
                    disabled={currentExerciseIndex === 0}
                  >
                    Restart
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={handleNext}
                    disabled={currentExerciseIndex === exercises.length - 1}
                  >
                    {currentExerciseIndex === exercises.length - 1 ? 'Finish' : 'Next Exercise'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="primary" 
                size="lg"
                className="mt-4 w-100"
                onClick={handleSubmit}
                disabled={userAnswer === null || (Array.isArray(userAnswer) && userAnswer.length === 0)}
              >
                Submit Answer
              </Button>
            )}
          </Card>
        </Col>

        <Col lg={4} className="mt-4 mt-lg-0">
          <Card className="p-3 progress-card shadow-sm">
            <h5 className="mb-3">Your Progress</h5>
            <ul className="progress-list list-unstyled">
              {progress.map((item, index) => (
                <li 
                  key={index} 
                  className={`d-flex justify-content-between align-items-center p-2 mb-2 rounded ${
                    item.correct ? 'bg-success text-white' : 'bg-danger text-white'
                  }`}
                >
                  <span>Exercise {index + 1}</span>
                  <span>Attempts: {item.attempts}</span>
                </li>
              ))}
              {progress.length === 0 && (
                <li className="text-muted">No attempts yet</li>
              )}
            </ul>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ExercisePage;