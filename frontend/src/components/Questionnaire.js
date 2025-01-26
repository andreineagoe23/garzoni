import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Questionnaire.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Questionnaire = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/questionnaire/`)
      .then((response) => {
        console.log("Questions API Response:", response.data); // Debug log
        setQuestions(response.data);
      })
      .catch((error) => {
        console.error("Error fetching questionnaire:", error);
      });
  }, []);

  const handleAnswer = (questionId, answer) => {
    if (!questionId) {
      console.error("Invalid question ID:", questionId);
      return;
    }

    const updatedAnswers = { ...answers, [questionId]: answer };
    setAnswers(updatedAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      axios
        .post(`${API_BASE_URL}/api/questionnaire/submit/`, {
          answers: updatedAnswers,
        })
        .then(() => navigate("/register"))
        .catch((error) =>
          console.error("Error submitting questionnaire:", error)
        );
    }
  };

  if (questions.length === 0) {
    return <div>Loading...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="questionnaire-container">
      <h2>{currentQuestion.text}</h2>
      <div className="options-container">
        {currentQuestion.options && Array.isArray(currentQuestion.options) ? (
          currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(currentQuestion.id, option)}
              className="option-button"
            >
              {option}
            </button>
          ))
        ) : (
          <p>No options available for this question.</p>
        )}
      </div>
    </div>
  );
};

export default Questionnaire;
