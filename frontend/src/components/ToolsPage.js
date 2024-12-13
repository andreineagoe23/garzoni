import React, { useEffect, useState } from "react";
import axios from "axios";
import ForexTools from "./ForexTools";
import CryptoTools from "./CryptoTools";
import BasicFinanceTools from "./BasicFinanceTools";
import NewsCalendars from "./NewsCalendars";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";

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
    <div className="container mt-5">
      <h1 className="text-center mb-4">Financial Tools</h1>
      {error ? (
        <div className="alert alert-danger text-center" role="alert">
          {error}
        </div>
      ) : (
        <div className="accordion" id="toolsAccordion">
          {categories.map((category, index) => (
            <div key={index} className="accordion-item mb-3">
              <h2 className="accordion-header" id={`heading-${index}`}>
                <button
                  className={`accordion-button ${
                    activeCategory === index ? "" : "collapsed"
                  }`}
                  type="button"
                  onClick={() => toggleCategory(index)}
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse-${index}`}
                  aria-expanded={activeCategory === index}
                  aria-controls={`collapse-${index}`}
                >
                  {category.category}
                </button>
              </h2>
              <div
                id={`collapse-${index}`}
                className={`accordion-collapse collapse ${
                  activeCategory === index ? "show" : ""
                }`}
                aria-labelledby={`heading-${index}`}
                data-bs-parent="#toolsAccordion"
              >
                <div className="accordion-body">
                  {category.category === "Forex Tools" && <ForexTools />}
                  {category.category === "Crypto Tools" && <CryptoTools />}
                  {category.category === "News & Calendars" && (
                    <NewsCalendars />
                  )}
                  {category.category === "Basic Finance & Budgeting Tools" && (
                    <BasicFinanceTools />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Chatbot />
    </div>
  );
};

export default ToolsPage;
