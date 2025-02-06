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
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

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
      return await fetchForexRate("usd", "eur"); // ✅ Add Forex Support
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

    // ✅ Check for financial data before calling AI
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

      // ✅ Ensure AI response is clean and relevant
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

            <select
              onChange={(e) =>
                setSelectedVoice(voices.find((v) => v.name === e.target.value))
              }
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
