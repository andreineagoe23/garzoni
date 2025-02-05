import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "../styles/QuizPage.css"; // Import the CSS file

function QuizPage() {
  const { courseId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [earnedMoney, setEarnedMoney] = useState(0); // To display the reward
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/quizzes/?course=${courseId}`,
          { withCredentials: true } // ✅ Use cookies for authentication
        );

        console.log(response.data); // Log the response to inspect its structure

        const quizData = response.data[0];
        setQuiz({
          id: quizData.id,
          title: quizData.title,
          question: quizData.question,
          choices: quizData.choices,
          correct_answer: quizData.correct_answer,
        });
      } catch (err) {
        console.error("Failed to fetch quiz:", err);
        setError("Failed to load quiz. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [courseId]);

  const handleSubmit = async () => {
    if (selectedAnswer === "") {
      setFeedback("Please select an answer before submitting.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/quizzes/complete/`,
        { quiz_id: quiz.id, selected_answer: selectedAnswer },
        { withCredentials: true } // ✅ Use cookies for authentication
      );

      console.log("Quiz Response: ", response.data);

      setFeedback(response.data.message);
      if (response.data.earned_money) {
        setEarnedMoney(response.data.earned_money);
      }
    } catch (err) {
      console.error("Error submitting answer:", err);
      setFeedback(
        err.response?.data?.message || "Something went wrong. Try again."
      );
    }
  };

  if (loading) return <p>Loading quiz...</p>;
  if (error) return <p>{error}</p>;
  if (!quiz) return <p>No quiz data available.</p>;

  return (
    <div className="quiz-container">
      <h2 className="quiz-title">Quiz: {quiz.title}</h2>
      <p className="quiz-question">{quiz.question}</p>
      {quiz.choices.map((choice, index) => (
        <div className="quiz-choice" key={index}>
          <input
            type="radio"
            id={`choice-${index}`}
            name="quiz"
            value={choice.text}
            onChange={(e) => setSelectedAnswer(e.target.value)}
          />
          <label htmlFor={`choice-${index}`}>{choice.text}</label>
        </div>
      ))}
      <button onClick={handleSubmit}>Submit Answer</button>
      {feedback && <p className="feedback">{feedback}</p>}
      {earnedMoney > 0 && (
        <p className="feedback">You earned £{earnedMoney.toFixed(2)}!</p>
      )}
    </div>
  );
}

export default QuizPage;
