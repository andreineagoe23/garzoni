import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import "../styles/scss/main.scss";

function FAQPage() {
  const { getAccessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [contactData, setContactData] = useState({
    email: "",
    topic: "",
    message: "",
  });
  const [submitMessage, setSubmitMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFaq, setSelectedFaq] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingStatus, setVotingStatus] = useState({});

  // Fetch FAQs from backend
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/faq/`
        );
        setFaqs(response.data);

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(response.data.map((faq) => faq.category)),
        ];
        setCategories(uniqueCategories);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  // Filter FAQs based on search and category
  const filteredFAQs = faqs.filter((faq) => {
    const matchesSearch =
      search === "" ||
      faq.question.toLowerCase().includes(search.toLowerCase()) ||
      faq.answer.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === "all" || faq.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  // Highlight search terms in text
  const highlightText = (text, query) => {
    if (!query || query.trim() === "") return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Handle contact form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage("");
    setErrorMessage("");

    try {
      const headers = {};
      if (getAccessToken()) {
        headers.Authorization = `Bearer ${getAccessToken()}`;
      }

      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/contact/`,
        contactData,
        { headers }
      );

      setSubmitMessage(
        res.data.message ||
          "Your message has been received! Thank you for contacting us."
      );
      setContactData({ email: "", topic: "", message: "" });
    } catch (err) {
      console.error("Contact form error:", err);
      setErrorMessage("Failed to send message. Please try again later.");
    }
  };

  // Toggle FAQ accordion
  const toggleFaq = (index) => {
    if (selectedFaq === index) {
      setSelectedFaq(null);
    } else {
      setSelectedFaq(index);
    }
  };

  // Submit vote for FAQ helpfulness
  const submitVote = async (faqId, vote) => {
    // Prevent double voting
    if (votingStatus[faqId]) return;

    try {
      setVotingStatus({
        ...votingStatus,
        [faqId]: "voting",
      });

      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/faq/${faqId}/vote/`,
        { vote }
      );

      setVotingStatus({
        ...votingStatus,
        [faqId]: vote,
      });

      // Refresh the status after 3 seconds
      setTimeout(() => {
        setVotingStatus((prevState) => ({
          ...prevState,
          [faqId]: null,
        }));
      }, 3000);
    } catch (err) {
      console.error("Vote failed", err);
      setVotingStatus({
        ...votingStatus,
        [faqId]: "error",
      });
    }
  };

  return (
    <div className="faq-page">
      <div className="content-wrapper">
        <h1 className="text-center mb-5">Frequently Asked Questions</h1>

        {/* Search bar */}
        <div className="search-container">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category filter buttons */}
        <div className="category-filters text-center">
          <button
            className={`btn ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`btn ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className="faq-accordion">
          {loading ? (
            <div className="text-center py-4">
              <p className="mb-0">Loading FAQs...</p>
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="text-center py-4">
              <p className="mb-0">
                No FAQs match your search. Try different keywords or clear your
                search.
              </p>
            </div>
          ) : (
            <div className="accordion">
              {filteredFAQs.map((faq, idx) => (
                <div className="accordion-item" key={idx}>
                  <h2 className="accordion-header">
                    <button
                      className={`accordion-button ${
                        selectedFaq === idx ? "" : "collapsed"
                      }`}
                      type="button"
                      onClick={() => toggleFaq(idx)}
                    >
                      <span className="badge">{faq.category}</span>
                      {highlightText(faq.question, search)}
                    </button>
                  </h2>
                  <div
                    className={`accordion-collapse collapse ${
                      selectedFaq === idx ? "show" : ""
                    }`}
                  >
                    <div className="accordion-body">
                      {highlightText(faq.answer, search)}

                      {/* Voting UI */}
                      <div className="faq-vote mt-3">
                        <span className="me-2">Was this helpful?</span>
                        {votingStatus[faq.id] === "helpful" ? (
                          <span className="text-success">
                            Thanks for your feedback! 👍
                          </span>
                        ) : votingStatus[faq.id] === "not_helpful" ? (
                          <span className="text-danger">
                            Thanks for your feedback! 👎
                          </span>
                        ) : votingStatus[faq.id] === "voting" ? (
                          <span>Submitting...</span>
                        ) : votingStatus[faq.id] === "error" ? (
                          <span className="text-danger">
                            Vote failed. Please try again.
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => submitVote(faq.id, "helpful")}
                              className="btn btn-sm btn-outline-success me-2"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => submitVote(faq.id, "not_helpful")}
                              className="btn btn-sm btn-outline-danger"
                            >
                              👎
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Form Section */}
        <div className="contact-form">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title text-center">
                Still Need Help? Contact Us
              </h3>

              {submitMessage && (
                <div className="alert alert-success">{submitMessage}</div>
              )}

              {errorMessage && (
                <div className="alert alert-danger">{errorMessage}</div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    Your Email
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    required
                    value={contactData.email}
                    onChange={(e) =>
                      setContactData({
                        ...contactData,
                        email: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="topic" className="form-label">
                    Topic
                  </label>
                  <select
                    className="form-select"
                    id="topic"
                    required
                    value={contactData.topic}
                    onChange={(e) =>
                      setContactData({
                        ...contactData,
                        topic: e.target.value,
                      })
                    }
                  >
                    <option value="">Select a topic</option>
                    <option value="Billing">Billing</option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Account">Account</option>
                    <option value="Content">Course Content</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="message" className="form-label">
                    Message
                  </label>
                  <textarea
                    className="form-control"
                    id="message"
                    rows="5"
                    required
                    value={contactData.message}
                    onChange={(e) =>
                      setContactData({
                        ...contactData,
                        message: e.target.value,
                      })
                    }
                  ></textarea>
                </div>

                <div className="d-grid">
                  <button type="submit" className="btn btn-primary">
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQPage;
