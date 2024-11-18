import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function QuizPage() {
  const { courseId } = useParams();
  const [quiz, setQuiz] = useState(null); // Initialize quiz as null
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const response = await axios.get(
          `http://localhost:8000/api/quizzes/?course=${courseId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        console.log("API Response:", response.data); // Log the API response

        // Assuming the response data is an array of quizzes, take the first quiz
        const quizData = response.data[0]; // Extract the first quiz from the array

        if (quizData && quizData.choices) {
          setQuiz({
            title: quizData.title,
            question: quizData.question,
            choices: quizData.choices, // Assuming 'choices' is an array of options
            correct_answer: quizData.correct_answer, // Fetch the correct answer
            id: quizData.id,
          });
        } else {
          setError("Quiz data is not properly structured.");
        }
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

    // Compare the selected answer with the correct answer
    if (selectedAnswer === quiz.correct_answer) {
      setFeedback("Correct!");
    } else {
      setFeedback("Incorrect. Try again!");
    }
  };

  if (loading) {
    return <p>Loading quiz...</p>; // Display loading message while fetching
  }

  if (error) {
    return <p>{error}</p>; // Display any errors that occur
  }

  if (!quiz) {
    return <p>No quiz data available.</p>; // Handle missing quiz data
  }

  return (
    <div>
      <h2>Quiz: {quiz.title}</h2>
      <p>{quiz.question}</p>
      {quiz.choices && quiz.choices.length > 0 ? (
        quiz.choices.map((choice, index) => (
          <div key={index}>
            <input
              type="radio"
              id={`choice-${index}`}
              name="quiz"
              value={choice.text} // Use choice.text to get the text of the option
              onChange={(e) => setSelectedAnswer(e.target.value)}
            />
            <label htmlFor={`choice-${index}`}>{choice.text}</label>{" "}
            {/* Use choice.text here as well */}
          </div>
        ))
      ) : (
        <p>No choices available for this question.</p>
      )}
      <button onClick={handleSubmit}>Submit Answer</button>
      {feedback && <p>{feedback}</p>}{" "}
      {/* Display feedback based on the answer */}
    </div>
  );
}

export default QuizPage;
