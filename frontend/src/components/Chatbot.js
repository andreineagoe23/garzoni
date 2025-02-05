import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Chatbot.css";
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = () => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const greetingMessage = {
        sender: "bot",
        text: "Hello! How can I assist you with finance today?",
      };
      setChatHistory((prev) => [...prev, greetingMessage]);
    }
  }, [isVisible]);

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    console.log("🔍 OpenAI API Key:", process.env.REACT_APP_OPENAI_API_KEY);

    const newMessage = { sender: "user", text: userInput };
    setChatHistory((prev) => [...prev, newMessage]);

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo", // ✅ Use free-tier model
          messages: [
            {
              role: "system",
              content:
                "You are a financial assistant helping users learn about finance.",
            },
            { role: "user", content: userInput },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ OpenAI Response:", response.data);
      const botMessage = {
        sender: "bot",
        text: response.data.choices[0].message.content,
      };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("❌ Error sending message to OpenAI:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "Error connecting to AI. Try again later." },
      ]);
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
      <button
        className="chatbot-toggle position-fixed"
        onClick={() => setIsVisible(!isVisible)}
      >
        💬
      </button>

      {isVisible && (
        <div className="chatbot-container position-fixed">
          <div className="chatbot-header d-flex align-items-center justify-content-between px-3 py-2">
            <span>Finance Assistant</span>
            <button
              className="btn btn-sm chatbot-close"
              onClick={() => setIsVisible(false)}
            >
              ✖
            </button>
          </div>

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

          <div className="chat-input-container d-flex p-2 border-top">
            <input
              type="text"
              className="form-control me-2 chat-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about finance..."
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
