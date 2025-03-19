import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = ({ isVisible, setIsVisible }) => {
  const location = useLocation();
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const HIDDEN_PAGES = [
    "/login",
    "/register",
    "/welcome",
    "/forgot-password",
    "/password-reset",
    "/questionnaire",
  ];

  const shouldShowChatbot =
    !HIDDEN_PAGES.includes(location.pathname) &&
    ((!isMobile && isVisible !== undefined) ||
      (isMobile && isVisible === true));

  const HF_API_KEY = process.env.REACT_APP_HF_API_KEY;
  const HF_MODEL = "HuggingFaceH4/zephyr-7b-alpha";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 992px)");
    setIsMobile(mediaQuery.matches);

    const handleResize = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handleResize);

    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    if (isVisible && !hasGreeted && shouldShowChatbot) {
      setChatHistory([
        {
          sender: "bot",
          text: "Hello! How can I assist you with finance today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [isVisible, hasGreeted, shouldShowChatbot]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setSelectedVoice((prev) => prev || availableVoices[0]);
      }
    };

    if (window.speechSynthesis.onvoiceschanged !== null) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    setTimeout(loadVoices, 500);
  }, []);

  const speakResponse = (text) => {
    if (isSpeechEnabled && selectedVoice) {
      const MAX_CHAR_LIMIT = 200;
      const sentences = text.match(
        new RegExp(`.{1,${MAX_CHAR_LIMIT}}(\\s|$)`, "g")
      );

      if (!sentences) return;

      window.speechSynthesis.cancel();

      let index = 0;
      const speakNextSentence = () => {
        if (index < sentences.length) {
          const speech = new SpeechSynthesisUtterance(sentences[index]);
          speech.voice = selectedVoice;

          speech.onend = () => {
            index++;
            speakNextSentence();
          };

          window.speechSynthesis.speak(speech);
        }
      };

      speakNextSentence();
    }
  };

  const checkFinancialQuery = async (message) => {
    if (message.toLowerCase().includes("stock price")) {
      return await fetchStockPrice(message.split(" ").pop().toUpperCase());
    }
    if (
      message.toLowerCase().includes("crypto") ||
      message.toLowerCase().includes("bitcoin")
    ) {
      return await fetchCryptoPrice("bitcoin");
    }
    if (
      message.toLowerCase().includes("forex") ||
      message.toLowerCase().includes("currency")
    ) {
      return await fetchForexRate("usd", "eur");
    }
    return null;
  };

  const fetchForexRate = async (from, to) => {
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${from}`
      );
      return `The exchange rate from ${from.toUpperCase()} to ${to.toUpperCase()} is ${
        response.data.rates[to.toUpperCase()]
      }`;
    } catch (error) {
      return "Sorry, I couldn't fetch Forex rates at the moment.";
    }
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
          inputs: `You are a finance expert. Answer only finance-related questions. Keep responses clear, structured, and under 3 sentences.\n\nUser: ${userInput}\nAssistant:`,
          parameters: { max_new_tokens: 200, temperature: 0.3, top_p: 0.8 },
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
        .replace(/User:.*?Assistant:/s, "")
        .replace(/Assistant:/g, "")
        .replace(/(You are a finance expert.*?\.)/s, "")
        .replace(/(\n\n)/g, "\n")
        .replace(/(\n\s+)/g, "\n")
        .replace(
          /Answer only finance-related questions. Keep responses clear, structured, and under 3 sentences./g,
          ""
        )
        .trim();

      setChatHistory((prev) => [...prev, { sender: "bot", text: aiResponse }]);
      speakResponse(aiResponse);
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

  if (!shouldShowChatbot) return null;

  return (
    <div className="chatbot">
      {!isMobile && (
        <button
          className="chatbot-toggle btn-accent"
          onClick={() => setIsVisible(!isVisible)}
        >
          💬
        </button>
      )}

      <div
        className={`chatbot-container ${isVisible ? "active" : ""} shadow-lg`}
      >
        <div className="chatbot-header d-flex align-items-center justify-content-between">
          <span className="fw-semibold">Finance Assistant</span>
          <button
            className="btn btn-link text-accent p-0"
            onClick={() => setIsVisible(false)}
          >
            ✖
          </button>
        </div>

        <div className="tts-toggle-container px-3 py-2">
          <label className="switch">
            <input
              type="checkbox"
              onChange={() => setIsSpeechEnabled(!isSpeechEnabled)}
            />
            <span className="slider"></span>
          </label>
          <span className="text-muted">🔊 Speak Answers</span>

          <select
            className="form-select form-select-sm ms-auto"
            onChange={(e) =>
              setSelectedVoice(voices.find((v) => v.name === e.target.value))
            }
            style={{ maxWidth: "150px" }}
          >
            {voices.length > 0 ? (
              voices.map((voice, index) => (
                <option key={index} value={voice.name}>
                  {voice.name}
                </option>
              ))
            ) : (
              <option>Loading voices...</option>
            )}
          </select>
        </div>

        <div className="chat-history p-3">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message mb-2 ${
                msg.sender === "user" ? "chat-user" : "chat-bot"
              } p-3 rounded`}
            >
              {msg.text}
            </div>
          ))}
          {isTyping && (
            <div className="chat-bot typing-animation p-3 rounded">
              Typing...
            </div>
          )}
        </div>

        <div className="chat-input-container d-flex gap-2 p-3">
          <button
            className="btn btn-accent voice-button rounded-circle p-2"
            onClick={startVoiceRecognition}
          >
            🎙
          </button>
          <input
            type="text"
            className="form-control rounded-pill"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMessageSend()}
            placeholder="Ask me about stocks or finance..."
          />
          <button
            className="btn btn-accent rounded-pill px-4"
            onClick={handleMessageSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
