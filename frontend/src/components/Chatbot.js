import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Chatbot.css";
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = () => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);

  const HF_API_KEY = process.env.REACT_APP_HF_API_KEY;
  const HF_MODEL = "HuggingFaceH4/zephyr-7b-alpha";

  useEffect(() => {
    if (isVisible && !hasGreeted) {
      setChatHistory([
        {
          sender: "bot",
          text: "Hello! How can I assist you with finance today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [isVisible, hasGreeted]);

  const speakResponse = (text) => {
    if (isSpeechEnabled) {
      const speech = new SpeechSynthesisUtterance();
      speech.text = text;
      speech.voice = window.speechSynthesis.getVoices()[0];
      window.speechSynthesis.speak(speech);
    }
  };

  const checkFinancialQuery = async (message) => {
    if (message.toLowerCase().includes("stock price")) {
      const stockSymbol = message.split(" ").pop().toUpperCase();
      return await fetchStockPrice(stockSymbol);
    }
    if (
      message.toLowerCase().includes("crypto") ||
      message.toLowerCase().includes("bitcoin")
    ) {
      return await fetchCryptoPrice("bitcoin");
    }
    return null;
  };

  const fetchStockPrice = async (symbol) => {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`
      );
      if (response.data[symbol]) {
        return `The current price of ${symbol.toUpperCase()} is $${
          response.data[symbol].usd
        } USD.`;
      } else {
        return `Sorry, I couldn't find the stock price for ${symbol}.`;
      }
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return "Sorry, I couldn't retrieve stock data.";
    }
  };

  const fetchCryptoPrice = async (cryptoId) => {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd`
      );
      return `The current price of ${cryptoId.toUpperCase()} is $${
        response.data[cryptoId].usd
      } USD.`;
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return "Sorry, I couldn't retrieve crypto data.";
    }
  };

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    setChatHistory((prev) => [...prev, { sender: "user", text: userInput }]);
    setIsTyping(true);

    const financialResponse = await checkFinancialQuery(userInput);
    if (financialResponse) {
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: financialResponse },
      ]);
      speakResponse(financialResponse);
      setIsTyping(false);
      setUserInput("");
      return;
    }

    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          inputs: `User: ${userInput}\nAssistant: (respond in 2-3 sentences, be concise and clear)`,
          parameters: { max_new_tokens: 200, temperature: 0.5, top_p: 0.8 },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      let aiResponse = response.data[0].generated_text.trim();
      aiResponse = aiResponse
        .replace("User:", "")
        .replace(userInput, "")
        .replace("Assistant:", "")
        .replace("(respond in 2-3 sentences, be concise and clear)", "")
        .trim();

      setChatHistory((prev) => [...prev, { sender: "bot", text: aiResponse }]);
      speakResponse(aiResponse); // ✅ Speak response if enabled
    } catch (error) {
      console.error("❌ Error sending message to Hugging Face:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "Error connecting to AI. Try again later." },
      ]);
    }

    setIsTyping(false);
    setUserInput("");
  };

  // ✅ Voice Input (Speech-to-Text)
  const startVoiceRecognition = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
      handleMessageSend();
    };
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

          <div className="tts-toggle-container">
            <label className="switch">
              <input
                type="checkbox"
                onChange={() => setIsSpeechEnabled(!isSpeechEnabled)}
              />
              <span className="slider"></span>
            </label>
            <span>🔊 Speak Answers</span>
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
            {isTyping && <p className="chat-bot typing-animation">Typing...</p>}
          </div>

          <div className="chat-input-container d-flex p-2 border-top">
            <button
              className="btn btn-sm voice-button"
              onClick={startVoiceRecognition}
            >
              🎙
            </button>
            <input
              type="text"
              className="form-control me-2 chat-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleMessageSend()}
              placeholder="Ask me about stocks or finance..."
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
