import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = ({ isVisible, setIsVisible }) => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const shouldShowChatbot = true;

  // Hugging Face Configuration
  const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.1";
  const HF_API_KEY = process.env.REACT_APP_HF_API_KEY;
  console.log("HF API Key Status:", HF_API_KEY ? "Loaded" : "Missing!");

  // Finance FAQ Fallback
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

  // System prompt template for Mistral
  const SYSTEM_PROMPT = `<<SYS>>
  You are a certified financial expert. Follow these rules:
  1. Answer ONLY personal finance questions
  2. Be concise (1-3 sentences)
  3. Use simple language
  4. If unsure, say "I recommend consulting a financial advisor"
  5. Never provide legal/tax advice
  <</SYS>>`;

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

  useEffect(() => {
    if (isMobile && !isVisible) {
      // Reset chat history when closing on mobile
      setChatHistory([]);
      setHasGreeted(false);
    }
  }, [isVisible, isMobile]);

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

  const startVoiceRecognition = () => {
    console.log("Voice recognition started");
  };

  const handleMessageSend = async () => {
    if (!userInput.trim()) return;

    // Add user message
    const newChat = [...chatHistory, { sender: "user", text: userInput }];
    setChatHistory(newChat);
    setIsTyping(true);

    try {
      // Check for API key
      if (!HF_API_KEY) throw new Error("API configuration error");

      // First check stock/crypto prices
      const financialData = await checkFinancialQuery(userInput);
      if (financialData) {
        updateChat(financialData);
        return;
      }

      // Check FAQ fallback
      const cleanInput = userInput.toLowerCase().replace(/[^\w\s]/gi, "");
      if (FINANCE_FAQ[cleanInput]) {
        updateChat(FINANCE_FAQ[cleanInput]);
        return;
      }

      // Format for Mistral instruction
      const prompt = `<s>[INST] ${SYSTEM_PROMPT}\n\nUser: ${userInput} [/INST]`;

      // API Call
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 256,
            temperature: 0.7,
            top_p: 0.9,
            repetition_penalty: 1.2,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 20000,
        }
      );

      // Process response
      let aiResponse = response.data[0]?.generated_text || "";
      aiResponse = aiResponse
        .replace(prompt, "")
        .replace(/<\/?s>|\[INST\]|\[\/INST\]/g, "")
        .replace(/<<SYS>>.*?<<\/SYS>>/gs, "")
        .trim();

      // Fallback if empty
      if (!aiResponse) throw new Error("Empty response from AI");

      updateChat(aiResponse);
    } catch (error) {
      handleError(error);
    } finally {
      setIsTyping(false);
      setUserInput("");
    }
  };

  // Helper functions
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
