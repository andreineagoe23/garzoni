import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

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
        const accessToken = localStorage.getItem("accessToken");
        const response = await axios.get(
          `http://localhost:8000/api/quizzes/?course=${courseId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const quizData = response.data[0];
        setQuiz({
          id: quizData.id, // Include quiz ID for backend submission
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

    const accessToken = localStorage.getItem("accessToken");
    try {
      const response = await axios.post(
        "http://localhost:8000/api/quizzes/complete/",
        { quiz_id: quiz.id, selected_answer: selectedAnswer },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      setFeedback(response.data.message);
      if (response.data.earned_money) {
        setEarnedMoney(response.data.earned_money);
      }
    } catch (err) {
      setFeedback(
        err.response?.data?.message || "Something went wrong. Try again."
      );
    }
  };

  if (loading) return <p>Loading quiz...</p>;
  if (error) return <p>{error}</p>;
  if (!quiz) return <p>No quiz data available.</p>;

  return (
    <div>
      <h2>Quiz: {quiz.title}</h2>
      <p>{quiz.question}</p>
      {quiz.choices.map((choice, index) => (
        <div key={index}>
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
      {feedback && <p>{feedback}</p>}
      {earnedMoney > 0 && <p>You earned £{earnedMoney.toFixed(2)}!</p>}
    </div>
  );
}

export default QuizPage;
