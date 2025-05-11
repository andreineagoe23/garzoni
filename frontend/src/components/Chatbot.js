import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import { useCallback } from "react";

const Chatbot = ({ isVisible, setIsVisible, isMobile }) => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const shouldShowChatbot = true;

  const HF_MODEL = "google/flan-t5-base";

  const FINANCE_FAQ = {
    budgeting:
      "Budgeting is the process of creating a plan to spend your money. This spending plan helps ensure you have enough for necessities while working toward financial goals.",
    saving:
      "Saving money involves setting aside a portion of income regularly. A good rule is the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
    investing:
      "Investing means putting money into assets like stocks or real estate with the expectation of growth. Always diversify to manage risk.",
    "credit score":
      "Your credit score (300-850) reflects creditworthiness. Pay bills on time, keep credit utilization low, and maintain old accounts to improve it.",
  };

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
        setSelectedVoice(
          (prev) =>
            prev || availableVoices.find((v) => v.default) || availableVoices[0]
        );
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    if (isMobile && voices.length === 0) {
      const interval = setInterval(() => {
        const mobileVoices = window.speechSynthesis.getVoices();
        if (mobileVoices.length > 0) {
          clearInterval(interval);
          loadVoices();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isMobile, voices.length]);

  const speakResponse = useCallback(
    (text) => {
      if (!isSpeechEnabled || !selectedVoice) return;

      const handleSpeak = () => {
        const MAX_CHAR_LIMIT = 200;
        const sentences =
          text.match(new RegExp(`.{1,${MAX_CHAR_LIMIT}}(\\s|$)`, "g")) || [];

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
      };

      if (isMobile) {
        const clickHandler = () => {
          handleSpeak();
          document.body.removeEventListener("click", clickHandler);
        };
        document.body.addEventListener("click", clickHandler);
      } else {
        handleSpeak();
      }
    },
    [isSpeechEnabled, selectedVoice, isMobile]
  );

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
        return `The current price of ${symbol.toUpperCase()} is $$${
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
      return `The current price of ${cryptoId.toUpperCase()} is $$${
        response.data[cryptoId].usd
      } USD.`;
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return "Sorry, I couldn't retrieve crypto data.";
    }
  };

  const startVoiceRecognition = () => {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      alert("Speech recognition is not supported in your browser");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };
  };

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    const newChat = [...chatHistory, { sender: "user", text: userInput }];
    setChatHistory(newChat);
    setIsTyping(true);

    try {
      const financialData = await checkFinancialQuery(userInput);
      if (financialData) {
        updateChat(financialData);
        return;
      }

      const cleanInput = userInput.toLowerCase().replace(/[^\w\s]/gi, "");
      if (FINANCE_FAQ[cleanInput]) {
        updateChat(FINANCE_FAQ[cleanInput]);
        return;
      }

      console.log(
        "Sending request to:",
        `${process.env.REACT_APP_BACKEND_URL}/proxy/hf/`
      );

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/proxy/hf/`.trim(),
        {
          model: HF_MODEL,
          inputs: userInput,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            top_p: 0.9,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      const aiResponse =
        response.data[0]?.generated_text?.trim() || "No answer found.";
      updateChat(aiResponse);
    } catch (error) {
      handleError(error);
    } finally {
      setIsTyping(false);
      setUserInput("");
    }
  };

  const updateChat = (text) => {
    setChatHistory((prev) => [...prev, { sender: "bot", text }]);
    speakResponse(text);
  };

  const handleError = (error) => {
    console.error("Chat Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const errorMessage = error.response?.data?.error?.includes("Authorization")
      ? "System maintenance in progress. Please try later."
      : FINANCE_FAQ[userInput.toLowerCase().replace(/[^\w\s]/gi, "")] ||
        "I'm having trouble connecting to financial data. Please try again.";

    setChatHistory((prev) => [...prev, { sender: "bot", text: errorMessage }]);
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
