import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Questionnaire.css";

const Questionnaire = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch questions from the backend
    axios
      .get("http://localhost:8000/api/questionnaire/")
      .then((response) => {
        setQuestions(response.data);
      })
      .catch((error) => {
        console.error("Error fetching questions:", error);
      });
  }, []);

  if (questions.length === 0) {
    return <div>Loading questions...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (questionId, answer) => {
    // Save answer locally
    const updatedAnswers = { ...answers, [questionId]: answer };
    setAnswers(updatedAnswers);

    // Update progress
    const newProgress = ((currentQuestionIndex + 1) / questions.length) * 100;
    setProgress(newProgress);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Submit answers and redirect to dashboard
      axios
        .post("http://localhost:8000/api/questionnaire/submit/", {
          answers: updatedAnswers,
        })
        .then(() => {
          navigate("/register"); // Redirect to registration after submission
        })
        .catch((error) => {
          console.error("Error submitting questionnaire:", error);
        });
    }
  };

  return (
    <div className="questionnaire-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      <h2>{currentQuestion.text}</h2>
      <div>
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            className="question-option"
            onClick={() => handleAnswer(currentQuestion.id, option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Questionnaire;
