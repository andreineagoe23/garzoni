import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Questionnaire.css";

const Questionnaire = () => {
  const [questions, setQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Get CSRF token first
        await axios.get(`${process.env.REACT_APP_BACKEND_URL}/csrf/`, {
          withCredentials: true,
        });

        // Fetch questions with credentials
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
          {
            withCredentials: true,
            headers: {
              "X-CSRFToken": document.cookie
                .split("; ")
                .find((row) => row.startsWith("csrftoken="))
                ?.split("=")[1],
            },
          }
        );

        console.log("Raw API response:", response.data);

        // Validate and transform response data
        const validatedQuestions = response.data.map((q) => {
          console.log("Original question:", q);

          let options = [];
          try {
            // Handle both array and stringified formats
            if (Array.isArray(q.options)) {
              options = q.options;
            } else {
              console.log("Original options string:", q.options);

              // Convert Python-style string to JSON format
              const jsonString = q.options
                .replace(/'/g, '"') // Replace single quotes with double quotes
                .replace(/\\"/g, '"') // Remove escaped quotes
                .replace(/^\[(.*)\]$/, "[$1]"); // Ensure proper array formatting

              console.log("Converted JSON string:", jsonString);

              options = JSON.parse(jsonString);
            }
          } catch (parseError) {
            console.error("Options parsing failed:", parseError);
            options = ["Error loading options"];
          }

          console.log("Final options array:", options);

          return {
            ...q,
            options: options,
          };
        });

        console.log("Validated questions:", validatedQuestions);
        setQuestions(validatedQuestions);
      } catch (error) {
        console.error("Full fetch error:", error);
        setError(error.response?.data?.error || "Failed to load questions");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleAnswer = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
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

  const handleSubmit = async () => {
    try {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
  
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
        { answers },
        {
          withCredentials: true,
          headers: {
            "X-CSRFToken": csrfToken,
            "Content-Type": "application/json",
          }
        }
      );
  
      if (response.data.success) {
        navigate("/personalized-path");
      }
      
    } catch (error) {
      setError(error.response?.data?.error || "Submission failed. Please try again.");
      console.error("Submit error:", error);
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
            <div className="budget-categories">
              {question.options.map((category, index) => (
                <div key={index} className="budget-category">
                  <label>{category}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={answers[question.id]?.[category] || 0}
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

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const hasAnswer = currentQuestion && currentQuestion.id in answers;

  return (
    <div className="questionnaire-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>

      {currentQuestion && (
        <>
          <h2>{currentQuestion.text}</h2>

          {renderQuestionInput(currentQuestion)}

          <div className="nav-controls">
            {currentStep > 0 && (
              <button
                className="nav-btn prev"
                onClick={() => setCurrentStep((prev) => prev - 1)}
              >
                ← Previous
              </button>
            )}

            {currentStep < questions.length - 1 ? (
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
