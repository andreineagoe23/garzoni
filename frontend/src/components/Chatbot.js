import React, { useState } from "react";
import axios from "axios";
import "../styles/Chatbot.css";

const Chatbot = () => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    const newMessage = { sender: "user", text: userInput };
    setChatHistory((prev) => [...prev, newMessage]);

    try {
      const response = await axios.post(
        "http://localhost:8000/api/chatbot/",
        { text: userInput },
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } }
      );

      const botMessage = { sender: "bot", text: response.data.response };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message to chatbot:", error);
      const errorMessage = { sender: "bot", text: "An error occurred. Please try again later." };
      setChatHistory((prev) => [...prev, errorMessage]);
    }

    setUserInput("");
  };

  return (
    <div>
      <button className="chatbot-toggle" onClick={() => setIsVisible(!isVisible)}>
        💬
      </button>

      {isVisible && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <span>Chatbot</span>
            <button className="close-button" onClick={() => setIsVisible(false)}>
              ✖
            </button>
          </div>
          <div className="chat-history">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={msg.sender === "user" ? "user-msg" : "bot-msg"}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input-container">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
            />
            <button onClick={handleMessageSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
