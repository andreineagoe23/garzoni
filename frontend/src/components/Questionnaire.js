import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Questionnaire.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Questionnaire = () => {
  const [questions, setQuestions] = useState([]); // Stores the questions fetched from the API
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Tracks the current question index
  const [answers, setAnswers] = useState({}); // Stores the answers provided by the user
  const navigate = useNavigate(); // Used for navigation to other routes

  // Fetches questions from the backend when the component is mounted
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/questionnaire/`) // Fetch questions from the API
      .then((response) => {
        setQuestions(response.data); // Set the questions in state
      })
      .catch((error) => {
        console.error("Error fetching questionnaire:", error); // Log any errors
      });
  }, []);

  // Handles the answer selection and progresses to the next question
  const handleAnswer = (questionId, answer) => {
    const updatedAnswers = { ...answers, [questionId]: answer }; // Update the answers state
    setAnswers(updatedAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      // Move to the next question if there are more
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Submit the answers to the backend when all questions are answered
      axios
        .post(`${API_BASE_URL}/api/questionnaire/submit/`, {
          answers: updatedAnswers,
        })
        .then(() => {
          navigate("/register"); // Navigate to the registration page
        })
        .catch((error) => {
          console.error("Error submitting questionnaire:", error); // Log any errors
        });
    }
  };

  // Show loading if questions are still being fetched
  if (questions.length === 0) {
    return <div>Loading...</div>;
  }

  // Get the current question to display
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="questionnaire-container">
      <h2>{currentQuestion.text}</h2>
      <div className="options-container">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswer(currentQuestion.id, option)}
            className="option-button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Questionnaire;
