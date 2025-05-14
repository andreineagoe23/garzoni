import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";

const Chatbot = ({ isVisible, setIsVisible, isMobile }) => {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const chatHistoryRef = useRef(null);
  const shouldShowChatbot = true;

  // Updated model to use a more capable one
  const HF_MODEL = "google/flan-t5-xl";
  
  // Enhanced financial FAQ with more detailed responses
  const FINANCE_FAQ = {
    budgeting:
      "Budgeting is the process of creating a plan to spend your money wisely. This spending plan helps ensure you have enough for necessities while working toward financial goals. I recommend starting with the 50/30/20 rule: allocate 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment.",
    saving:
      "When it comes to saving money, consistency is key. Set up automatic transfers to your savings account on payday. Consider high-yield savings accounts for your emergency fund (aim for 3-6 months of expenses). For long-term goals, look into certificates of deposit (CDs) or money market accounts.",
    investing:
      "Investing means putting money into assets with the expectation of growth. Start with broad index funds for diversification. If your employer offers a 401(k) match, contribute at least enough to get the full match - it's essentially free money. Remember that time in the market beats timing the market.",
    "credit score":
      "Your credit score (ranging from 300-850) is a numerical representation of your creditworthiness. To improve it: pay all bills on time (35% of your score), keep credit utilization below 30% (30% of score), maintain a long credit history (15%), have a diverse credit mix (10%), and limit new credit applications (10%).",
    retirement:
      "For retirement planning, take advantage of tax-advantaged accounts like 401(k)s and IRAs. The power of compound interest means starting early is crucial - even small contributions can grow significantly over decades. A common guideline is to save 15% of your income for retirement.",
    "debt management":
      "When managing debt, focus first on high-interest debt like credit cards. Consider the avalanche method (targeting highest interest rates first) or the snowball method (paying off smallest balances first for psychological wins). For student loans, look into income-driven repayment plans or refinancing options.",
    "emergency fund":
      "An emergency fund is your financial safety net. Aim to save 3-6 months of essential expenses in a readily accessible account. Start with a goal of $1,000, then build from there. This fund helps prevent going into debt when unexpected expenses arise.",
    "tax planning":
      "Effective tax planning can significantly increase your net worth. Maximize contributions to tax-advantaged accounts, harvest tax losses in investment accounts, and keep records of deductible expenses. Consider consulting with a tax professional to optimize your specific situation.",
    stocks: 
      "Stocks represent ownership in a company. When investing in stocks, focus on diversification across sectors and company sizes. For most people, low-cost index funds are the best approach rather than picking individual stocks. Remember that the stock market has historically yielded around 7% annually over the long term, despite short-term volatility.",
    cryptocurrencies:
      "Cryptocurrencies are highly volatile digital assets. While they offer potential for significant returns, they also come with substantial risk. Consider allocating only a small percentage of your portfolio to crypto (generally no more than 5%), and only invest what you can afford to lose. Research thoroughly before investing in any specific cryptocurrency."
  };

  useEffect(() => {
    if (isVisible && !hasGreeted && shouldShowChatbot) {
      setChatHistory([
        {
          sender: "bot",
          text: "Hello! I'm your financial assistant. Ask me about budgeting, investing, saving, cryptocurrencies, or any other finance topic. How can I help you today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [isVisible, hasGreeted, shouldShowChatbot]);

  useEffect(() => {
    // Auto-scroll chat history to bottom when new messages appear
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

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
    const lowercaseMsg = message.toLowerCase();
    
    // Stock price checking
    if (lowercaseMsg.includes("stock price") || lowercaseMsg.includes("stock value") || 
        lowercaseMsg.match(/price of (.*?) stock/) || lowercaseMsg.match(/how much is (.*?) stock/)) {

      const words = lowercaseMsg.split(" ");
      let ticker = "";
      
      for (let i = 0; i < words.length; i++) {
        if (words[i] === "stock" && i > 0) {
          ticker = words[i-1].toUpperCase();
          break;
        }
      }
      
      if (!ticker) {
        ticker = words[words.length-1].toUpperCase();
      }
      
      return await fetchStockPrice(ticker);
    }
    
    // Crypto price checking
    if (lowercaseMsg.includes("crypto") || lowercaseMsg.includes("bitcoin") || 
        lowercaseMsg.includes("ethereum") || lowercaseMsg.includes("cryptocurrency")) {
      
      let cryptoId = "bitcoin"; // Default
      
      if (lowercaseMsg.includes("ethereum") || lowercaseMsg.includes("eth")) {
        cryptoId = "ethereum";
      } else if (lowercaseMsg.includes("dogecoin") || lowercaseMsg.includes("doge")) {
        cryptoId = "dogecoin";
      } else if (lowercaseMsg.includes("litecoin") || lowercaseMsg.includes("ltc")) {
        cryptoId = "litecoin";
      } else if (lowercaseMsg.includes("cardano") || lowercaseMsg.includes("ada")) {
        cryptoId = "cardano";
      }
      
      return await fetchCryptoPrice(cryptoId);
    }
    
    // Forex/currency exchange rate checking
    if (lowercaseMsg.includes("forex") || lowercaseMsg.includes("currency") || 
        lowercaseMsg.includes("exchange rate") || lowercaseMsg.includes("exchange rates")) {
      
      let fromCurrency = "usd";
      let toCurrency = "eur";
      
      // Try to extract currencies from the message
      const currencyCodes = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf"];
      
      for (const code of currencyCodes) {
        if (lowercaseMsg.includes(code)) {
          if (fromCurrency === "usd") {
            fromCurrency = code;
          } else {
            toCurrency = code;
            break;
          }
        }
      }
      
      return await fetchForexRate(fromCurrency, toCurrency);
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
      }. This means 1 ${from.toUpperCase()} equals ${response.data.rates[to.toUpperCase()]} ${to.toUpperCase()}.`;
    } catch (error) {
      console.error("Error fetching Forex rates:", error);
      return "Sorry, I couldn't fetch Forex rates at the moment. Please try again later.";
    }
  };

  const fetchStockPrice = async (symbol) => {
    try {
      // Using a more reliable endpoint for stocks
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
      );
      
      if (response.data[symbol.toLowerCase()]) {
        return `The current price of ${symbol.toUpperCase()} is $${
          response.data[symbol.toLowerCase()].usd
        } USD.`;
      } else {
        return `Sorry, I couldn't find the stock price for ${symbol}. Please check the ticker symbol and try again.`;
      }
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return "Sorry, I couldn't retrieve stock data. This might be due to API limitations or an invalid ticker symbol.";
    }
  };

  const fetchCryptoPrice = async (cryptoId) => {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd`
      );
      
      if (response.data[cryptoId]) {
        return `The current price of ${cryptoId.charAt(0).toUpperCase() + cryptoId.slice(1)} is $${
          response.data[cryptoId].usd
        } USD.`;
      } else {
        return `Sorry, I couldn't find the price for ${cryptoId}. Please check the name and try again.`;
      }
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return "Sorry, I couldn't retrieve cryptocurrency data. This might be due to API limitations or an invalid crypto name.";
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

    // Provide visual feedback that voice recognition is active
    setChatHistory(prev => [...prev, { sender: "system", text: "Listening..." }]);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
      
      setChatHistory(prev => prev.filter(msg => msg.text !== "Listening..."));
      
      // Auto-send the voice message
      handleMessageSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      // Remove the "Listening..." message in case of error
      setChatHistory(prev => prev.filter(msg => msg.text !== "Listening..."));
    };
  };

  const handleMessageSend = async (voiceInput = null) => {
    const input = voiceInput || userInput;
    if (!input.trim()) return;

    const newChat = [...chatHistory, { sender: "user", text: input }];
    setChatHistory(newChat);
    setIsTyping(true);
    
    if (!voiceInput) {
      setUserInput("");
    }

    try {
      // First check if it's a financial query that can be handled directly
      const financialData = await checkFinancialQuery(input);
      if (financialData) {
        updateChat(financialData);
        return;
      }

      // Check for FAQ matches with improved preprocessing
      const cleanInput = input.toLowerCase().replace(/[^\w\s]/gi, "").trim();
      
      // Look for keyword matches in the FAQ
      for (const [key, value] of Object.entries(FINANCE_FAQ)) {
        if (cleanInput.includes(key)) {
          updateChat(value);
          return;
        }
      }

       const apiUrl = process.env.REACT_APP_BACKEND_URL 
        ? `${process.env.REACT_APP_BACKEND_URL}/proxy/hf/`
        : 'https://andreineagoe23.pythonanywhere.com/api/proxy/hf/';
      
      console.log("Sending request to:", apiUrl);

      const response = await axios.post(
        apiUrl,
        {
          model: HF_MODEL,
          inputs: `Answer this financial question: ${input}. Provide a helpful and detailed response.`,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true
          },
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json"
          },
        }
      );

      // Extract the response properly based on the API format
      let aiResponse = "I'm sorry, I couldn't generate a proper response.";
      
      if (Array.isArray(response.data) && response.data[0]?.generated_text) {
        aiResponse = response.data[0].generated_text.trim();
      } else if (response.data?.generated_text) {
        aiResponse = response.data.generated_text.trim();
      } else if (typeof response.data === 'string') {
        aiResponse = response.data.trim();
      }
      
      // Fallback to generic response if the API doesn't return usable content
      if (!aiResponse || aiResponse.length < 10) {
        aiResponse = "I'm sorry, but I don't have specific information about that financial topic. Would you like to know about budgeting, investing, savings, or credit scores instead?";
      }

      updateChat(aiResponse);
    } catch (error) {
      handleError(error, input);
    } finally {
      setIsTyping(false);
    }
  };

  const updateChat = (text) => {
    setChatHistory((prev) => [...prev, { sender: "bot", text }]);
    speakResponse(text);
  };

  const handleError = (error, userQuery) => {
    console.error("Chat Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // More informative error handling
    let errorMessage;
    
    if (error.response?.status === 404) {
      errorMessage = "I'm having trouble connecting to our AI services. This appears to be a server configuration issue. Please try again later while we fix it.";
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = "Your session may have expired. Please refresh the page and try logging in again.";
    } else if (error.response?.data?.error?.includes("Authorization")) {
      errorMessage = "System maintenance in progress. Please try again later.";
    } else {
      // Try to find a relevant FAQ answer
      const cleanQuery = userQuery.toLowerCase().replace(/[^\w\s]/gi, "");
      for (const [key, value] of Object.entries(FINANCE_FAQ)) {
        if (cleanQuery.includes(key)) {
          errorMessage = value;
          break;
        }
      }
      
      // If no FAQ match, provide a generic but helpful response
      if (!errorMessage) {
        errorMessage = "I'm having trouble connecting to our financial data services. In the meantime, I can still answer general finance questions about budgeting, investing, saving, or credit scores. How can I help you?";
      }
    }

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
              checked={isSpeechEnabled}
            />
            <span className="slider"></span>
          </label>
          <span className="text-muted">🔊 Speak Answers</span>

          <select
            className="form-select form-select-sm ms-auto"
            onChange={(e) =>
              setSelectedVoice(voices.find((v) => v.name === e.target.value))
            }
            value={selectedVoice?.name || ""}
            style={{ maxWidth: "150px" }}
            disabled={!isSpeechEnabled}
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

        <div className="chat-history p-3" ref={chatHistoryRef}>
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message mb-2 ${
                msg.sender === "user" 
                  ? "chat-user" 
                  : msg.sender === "system" 
                    ? "chat-system" 
                    : "chat-bot"
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
            placeholder="Ask me about finance, budgeting, investing..."
          />
          <button
            className="btn btn-accent rounded-pill px-4"
            onClick={() => handleMessageSend()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;