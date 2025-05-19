import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/scss/main.scss";
import Header from "./Header";
import { useAuth } from "./AuthContext";

const Questionnaire = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        const validatedQuestions = response.data.map((q) => {
          let options = [];
          try {
            if (Array.isArray(q.options)) {
              options = q.options;
            } else {
              const jsonString = q.options
                .replace(/'/g, '"')
                .replace(/\\"/g, '"')
                .replace(/^\[(.*)\]$/, "[$1]");
              options = JSON.parse(jsonString);
            }
          } catch (parseError) {
            console.error("Options parsing failed:", parseError);
            options = ["Error loading options"];
          }

          return {
            ...q,
            options: options,
          };
        });

        setQuestions(validatedQuestions);
      } catch (error) {
        setError(error.response?.data?.error || "Failed to load questions");
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [getAccessToken]);

  // Keep handler functions the same
  const handleAnswer = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBudgetChange = (questionId, category, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [category]: value,
      },
    }));
  };

  // Questionnaire.js
  const handleSubmit = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
        { answers },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      // Redirect to payment if needed
      if (response.data.redirect_url) {
        window.location.href = response.data.redirect_url;
      } else {
        // Handle free tier access
        navigate("/personalized-path");
      }
    } catch (error) {
      setError(error.response?.data?.error || "Payment setup failed");
    }
  };

  const renderQuestionInput = (question) => {
    switch (question.type) {
      case "knowledge_check":
        return (
          <div className="options-grid">
            {question.options?.map((option, index) => (
              <button
                key={index}
                className={`option-btn ${
                  answers[question.id] === option ? "selected" : ""
                }`}
                onClick={() => handleAnswer(question.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
        );

      case "preference_scale":
        return (
          <div className="scale-container">
            {[1, 2, 3, 4, 5].map((num) => (
              <label key={num} className="scale-label">
                <input
                  type="radio"
                  name="scale"
                  value={num}
                  checked={answers[question.id] === num.toString()}
                  onChange={() => handleAnswer(question.id, num.toString())}
                />
                <span className="scale-number">{num}</span>
              </label>
            ))}
            <div className="scale-labels">
              <span>Strongly Disagree</span>
              <span>Strongly Agree</span>
            </div>
          </div>
        );

      case "budget_allocation":
        return (
          <div className="budget-container">
            <Header />
            <div className="budget-categories">
              {question.options.map((category, index) => (
                <div key={index} className="budget-category">
                  <label>{category}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={answers[question.id]?.[category] || ""}
                    onChange={(e) =>
                      handleBudgetChange(question.id, category, e.target.value)
                    }
                  />
                  %
                </div>
              ))}
            </div>
            <div className="budget-sum">
              Total:{" "}
              {Object.values(answers[question.id] || {}).reduce(
                (a, b) => a + parseInt(b),
                0
              )}
              %
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) return <div className="loading">Loading questions...</div>;
  if (error) return <div className="error">{error}</div>;

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const hasAnswer = currentQuestion && currentQuestion.id in answers;

  return (
    <div className="questionnaire-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>

      {currentQuestion && (
        <>
          <h2>{currentQuestion.text}</h2>

          {renderQuestionInput(currentQuestion)}

          <div className="nav-controls">
            {currentQuestionIndex > 0 && (
              <button
                className="nav-btn prev"
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              >
                ← Previous
              </button>
            )}

            {currentQuestionIndex < questions.length - 1 ? (
              <button
                className="nav-btn next"
                onClick={handleNext}
                disabled={!hasAnswer}
              >
                Next →
              </button>
            ) : (
              <button
                className="nav-btn submit"
                onClick={handleSubmit}
                disabled={!hasAnswer}
              >
                Submit Questionnaire
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Questionnaire;
