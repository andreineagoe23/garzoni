import React, { useEffect, useState } from "react";
import axios from "axios";
import SavingsGoalCalculator from "./SavingsGoalCalculator";
import "../styles/SavingsGoalCalculator.css";

const ToolsPage = () => {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await axios.get("http://localhost:8000/api/tools/", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });
        setCategories(response.data);
      } catch (error) {
        console.error("Error fetching tools:", error);
        setError(error.message || "Error fetching tools.");
      }
    };

    fetchTools();
  }, []);

  const toggleCategory = (index) => {
    setActiveCategory(activeCategory === index ? null : index);
  };

  return (
    <div className="tools-container">
      <h1>Tools</h1>
      {error ? (
        <p className="error-message">Error: {error}</p>
      ) : (
        categories.map((category, index) => (
          <div key={index} className="category">
            <h2 onClick={() => toggleCategory(index)}>{category.category}</h2>
            {activeCategory === index && (
              <ul className="tool-list">
                {category.items.map((tool, idx) => (
                  <li key={idx}>
                    <strong>{tool.name}</strong>: {tool.description}
                  </li>
                ))}
                {category.category === "Basic Finance & Budgeting Tools" && (
                  <SavingsGoalCalculator />
                )}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ToolsPage;
