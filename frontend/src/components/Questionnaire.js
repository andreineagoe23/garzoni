import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Questionnaire.css";

function Questionnaire() {
  const [answers, setAnswers] = useState({
    question1: "",
    question2: "",
    question3: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
    } else {
      axios
        .get("http://localhost:8000/api/questionnaire/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          if (response.data) setAnswers(response.data); // Pre-fill if answers exist
        })
        .catch((error) => {
          console.error("Failed to fetch questionnaire data:", error);
        });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setAnswers({ ...answers, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const accessToken = localStorage.getItem("accessToken");
      await axios.post("http://localhost:8000/api/questionnaire/", answers, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      navigate("/dashboard"); // Redirect after submission
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
    }
  };

  return (
    <div className="questionnaire-container">
      <h2>Complete Your Profile</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <h3>1. What is your primary financial goal?</h3>
          <label>
            <input
              type="radio"
              name="question1"
              value="Save and budget effectively"
              checked={answers.question1 === "Save and budget effectively"}
              onChange={handleChange}
            />
            Save and budget effectively
          </label>
          <label>
            <input
              type="radio"
              name="question1"
              value="Start investing"
              checked={answers.question1 === "Start investing"}
              onChange={handleChange}
            />
            Start investing
          </label>
          <label>
            <input
              type="radio"
              name="question1"
              value="Achieve financial independence"
              checked={answers.question1 === "Achieve financial independence"}
              onChange={handleChange}
            />
            Achieve financial independence
          </label>
        </div>

        <div>
          <h3>2. What is your current financial knowledge level?</h3>
          <label>
            <input
              type="radio"
              name="question2"
              value="Beginner"
              checked={answers.question2 === "Beginner"}
              onChange={handleChange}
            />
            Beginner
          </label>
          <label>
            <input
              type="radio"
              name="question2"
              value="Intermediate"
              checked={answers.question2 === "Intermediate"}
              onChange={handleChange}
            />
            Intermediate
          </label>
          <label>
            <input
              type="radio"
              name="question2"
              value="Advanced"
              checked={answers.question2 === "Advanced"}
              onChange={handleChange}
            />
            Advanced
          </label>
        </div>

        <div>
          <h3>3. What is your preferred learning style?</h3>
          <label>
            <input
              type="radio"
              name="question3"
              value="Interactive and hands-on"
              checked={answers.question3 === "Interactive and hands-on"}
              onChange={handleChange}
            />
            Interactive and hands-on
          </label>
          <label>
            <input
              type="radio"
              name="question3"
              value="Video tutorials and webinars"
              checked={answers.question3 === "Video tutorials and webinars"}
              onChange={handleChange}
            />
            Video tutorials and webinars
          </label>
          <label>
            <input
              type="radio"
              name="question3"
              value="Reading articles and guides"
              checked={answers.question3 === "Reading articles and guides"}
              onChange={handleChange}
            />
            Reading articles and guides
          </label>
        </div>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default Questionnaire;
