import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Chatbot.css"; // <-- new stylesheet
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = () => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const greetingMessage = {
        sender: "bot",
        text: "Hello! How can I assist you today?",
      };
      setChatHistory((prev) => [...prev, greetingMessage]);
    }
  }, [isVisible]);

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    const newMessage = { sender: "user", text: userInput };
    setChatHistory((prev) => [...prev, newMessage]);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/chatbot/`,
        { text: userInput },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      const botMessage = { sender: "bot", text: response.data.response };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message to chatbot:", error);
      const errorMessage = {
        sender: "bot",
        text: "An error occurred. Please try again later.",
      };
      setChatHistory((prev) => [...prev, errorMessage]);
    }

    setUserInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleMessageSend();
    }
  };

  return (
    <div>
      {/* Chatbot Toggle Button */}
      <button
        className="chatbot-toggle position-fixed"
        onClick={() => setIsVisible(!isVisible)}
      >
        💬
      </button>

      {/* Chatbot Container */}
      {isVisible && (
        <div className="chatbot-container position-fixed">
          {/* Chatbot Header */}
          <div className="chatbot-header d-flex align-items-center justify-content-between px-3 py-2">
            <span>Monevo Assistant</span>
            <button
              className="btn btn-sm chatbot-close"
              onClick={() => setIsVisible(false)}
            >
              ✖
            </button>
          </div>

          {/* Chat History */}
          <div className="chat-history p-3 flex-grow-1">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-message mb-2 ${
                  msg.sender === "user" ? "chat-user" : "chat-bot"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="chat-input-container d-flex p-2 border-top">
            <input
              type="text"
              className="form-control me-2 chat-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
            />
            <button className="btn chatbot-send" onClick={handleMessageSend}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
