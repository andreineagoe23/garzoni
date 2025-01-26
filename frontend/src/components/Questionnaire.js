import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Questionnaire.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Questionnaire = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/questionnaire/`)
      .then((response) => {
        if (response.data && Array.isArray(response.data)) {
          setQuestions(response.data);
        } else {
          setErrorMessage("Unexpected API response format.");
          console.error("Unexpected API response:", response.data);
        }
      })
      .catch((error) => {
        setErrorMessage("Failed to fetch questions. Please try again later.");
        console.error("Error fetching questions:", error);
      });
  }, []);

  if (errorMessage) {
    return <div className="error-message">{errorMessage}</div>;
  }

  if (questions.length === 0) {
    return <div>Loading questions...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (questionId, answer) => {
    const updatedAnswers = { ...answers, [questionId]: answer };
    setAnswers(updatedAnswers);

    const newProgress = ((currentQuestionIndex + 1) / questions.length) * 100;
    setProgress(newProgress);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      axios
        .post(`${API_BASE_URL}/api/questionnaire/submit/`, {
          answers: updatedAnswers,
        })
        .then(() => {
          navigate("/register");
        })
        .catch((error) => {
          setErrorMessage("Failed to submit questionnaire. Please try again.");
          console.error("Error submitting questionnaire:", error);
        });
    }
  };

  return (
    <div className="questionnaire-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      <h2>{currentQuestion?.text || "No question available."}</h2>
      <div>
        {currentQuestion?.options?.map((option, index) => (
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
