import React, { useEffect, useState } from "react";
import axios from "axios";
import ForexTools from "./ForexTools";
import CryptoTools from "./CryptoTools";
import BasicFinanceTools from "./BasicFinanceTools";
import NewsCalendars from "./NewsCalendars";
import Chatbot from "./Chatbot";
import { Accordion } from "react-bootstrap";
import "../styles/scss/main.scss";

const ToolsPage = () => {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/tools/`,
          { withCredentials: true }
        );

        const reorderedCategories = response.data.sort((a, b) =>
          a.category === "Crypto Tools"
            ? -1
            : b.category === "Crypto Tools"
            ? 1
            : 0
        );

        setCategories(reorderedCategories);
        setActiveCategory(0); // Auto-expand first category
      } catch (error) {
        setError(error.message || "Error fetching tools.");
      }
    };

    fetchTools();
  }, []);

  const handleAccordionToggle = (index) => {
    setActiveCategory(activeCategory === index ? null : index);
  };

  return (
    <div className="tools-page">
      <div className="content-container">
        <h1 className="tools-title display-4 fw-bold">Financial Tools</h1>

        {error ? (
          <div className="alert alert-danger text-center">{error}</div>
        ) : (
          <Accordion activeKey={activeCategory?.toString()}>
            {categories.map((category, index) => (
              <Accordion.Item
                key={index}
                eventKey={index.toString()}
                className="mb-3"
              >
                <Accordion.Header
                  onClick={() => handleAccordionToggle(index)}
                  className="fw-semibold"
                >
                  {category.category}
                </Accordion.Header>
                <Accordion.Body>
                  {category.category === "Forex Tools" && <ForexTools />}
                  {category.category === "Crypto Tools" && <CryptoTools />}
                  {category.category === "News & Calendars" && (
                    <NewsCalendars />
                  )}
                  {category.category === "Basic Finance & Budgeting Tools" && (
                    <BasicFinanceTools />
                  )}
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </div>
      <Chatbot />
    </div>
  );
};

export default ToolsPage;
