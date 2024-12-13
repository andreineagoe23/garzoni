import React, { useState, useEffect } from "react";
import axios from "axios";
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
        "http://localhost:8000/api/chatbot/",
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
        style={{
          bottom: "20px",
          right: "50px",
          zIndex: 1000,
          backgroundColor: "#002D0B", // Dark forest green
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "80px",
          height: "80px",
          fontSize: "24px",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)",
        }}
        onClick={() => setIsVisible(!isVisible)}
      >
        💬
      </button>

      {/* Chatbot Container */}
      {isVisible && (
        <div
          className="chatbot-container position-fixed"
          style={{
            bottom: "90px",
            right: "20px",
            width: "400px",
            height: "500px",
            zIndex: 1000,
            backgroundColor: "#f8f9fa", // Light grey
            borderRadius: "12px",
            boxShadow: "0px 8px 15px rgba(0, 0, 0, 0.2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Chatbot Header */}
          <div
            className="chatbot-header d-flex align-items-center justify-content-between px-3 py-2"
            style={{
              backgroundColor: "#00471b",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            <span>Monevo Assistant</span>
            <button
              className="btn btn-sm"
              style={{
                backgroundColor: "transparent",
                color: "#fff",
                border: "none",
                fontSize: "18px",
              }}
              onClick={() => setIsVisible(false)}
            >
              ✖
            </button>
          </div>

          {/* Chat History */}
          <div
            className="chat-history p-3 flex-grow-1"
            style={{
              overflowY: "auto",
              backgroundColor: "#e9ecef", // Soft grey
              padding: "10px",
              display: "flex",
              flexDirection: "column", // Flex column to stack messages
            }}
          >
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className="mb-2"
                style={{
                  maxWidth: "70%",
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", // Align right for user, left for bot
                  backgroundColor:
                    msg.sender === "user" ? "#00471b" : "#dee2e6", // Green for user, light grey for bot
                  color: msg.sender === "user" ? "#fff" : "#000",
                  padding: "10px 15px",
                  borderRadius: "15px",
                  boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div
            className="chat-input-container d-flex p-2 border-top"
            style={{ backgroundColor: "#f8f9fa" }}
          >
            <input
              type="text"
              className="form-control me-2"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              style={{
                borderRadius: "30px",
                padding: "10px 15px",
                border: "1px solid #ced4da",
              }}
            />
            <button
              className="btn"
              style={{
                backgroundColor: "#002D0B",
                color: "#fff",
                borderRadius: "30px",
                padding: "10px 20px",
              }}
              onClick={handleMessageSend}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
