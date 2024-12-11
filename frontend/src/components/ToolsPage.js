import React, { useEffect, useState } from "react";
import axios from "axios";
import ForexTools from "./ForexTools";
import CryptoTools from "./CryptoTools";
import BasicFinanceTools from "./BasicFinanceTools";

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
              <div className="tool-section">
                {category.category === "Forex Tools" && <ForexTools />}
                {category.category === "Crypto Tools" && <CryptoTools />}
                {category.category === "Basic Finance & Budgeting Tools" && (
                  <BasicFinanceTools />
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ToolsPage;
