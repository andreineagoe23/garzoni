import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import { useAuth } from "./AuthContext";

const LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "zh-CN", name: "Chinese" },
];

const Chatbot = ({ isVisible, onClose, isMobile }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [userAvatar, setUserAvatar] = useState("/default-avatar.png");
  const messagesEndRef = useRef(null);
  const { getAccessToken, isInitialized, isAuthenticated } = useAuth();
  const [chatHistory, setChatHistory] = useState([]);
  const [quickReplies] = useState([
    "💰 What is compound interest?",
    "📚 Show me learning paths",
    "📊 Recommend a course for me",
    "📈 What's the price of Bitcoin?",
    "💼 How do I start investing?",
  ]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);

  const navigate = useNavigate();

  const handleCourseClick = (path) => {
    onClose();

    if (path.includes("#")) {
      const [basePath, anchor] = path.split("#");

      // Store anchor for delayed scroll after page load
      sessionStorage.setItem("scrollToPathId", anchor);

      navigate(basePath);
    } else {
      navigate(path);
    }
  };

  useEffect(() => {
    if (isVisible && !hasGreeted) {
      setMessages([
        {
          sender: "bot",
          text: "Hello! I'm your financial assistant. Ask me about budgeting, investing, saving, cryptocurrencies, retirement planning, or any other finance topic. How can I help you today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [isVisible, hasGreeted]);

  // Add body scroll lock effect for mobile
  useEffect(() => {
    if (isMobile && isVisible) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else if (isMobile) {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
  }, [isMobile, isVisible]);

  useEffect(() => {
    // Auto-scroll chat history to bottom when new messages appear
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

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

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const fetchUserAvatar = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        if (response.data.profile_avatar) {
          setUserAvatar(response.data.profile_avatar);
        }
      } catch (error) {
        console.error("Error fetching user avatar:", error);
      }
    };

    fetchUserAvatar();
  }, [getAccessToken, isInitialized, isAuthenticated]);

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
    recognition.lang = selectedLanguage; // Use selected language
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Provide visual feedback that voice recognition is active
    setMessages((prev) => [
      ...prev,
      { sender: "system", text: "Listening..." },
    ]);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);

      setMessages((prev) => prev.filter((msg) => msg.text !== "Listening..."));

      // Auto-send the voice message
      handleMessageSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      // Remove the "Listening..." message in case of error
      setMessages((prev) => prev.filter((msg) => msg.text !== "Listening..."));
    };
  };

  const handleMessageSend = async (message = null) => {
    if (!isAuthenticated) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: "bot",
          text: "Please log in to use the chatbot. You will be redirected to the login page.",
        },
      ]);
      navigate("/login");
      return;
    }

    const userMessage = message || inputMessage;
    if (!userMessage.trim()) return;

    setInputMessage("");

    // Add user message to the chat
    const userChatObj = { sender: "user", text: userMessage };
    setMessages((prevMessages) => [...prevMessages, userChatObj]);

    // Add user message to chat history
    const userHistoryObj = { role: "user", content: userMessage };
    const updatedHistory = [...chatHistory, userHistoryObj];
    setChatHistory(updatedHistory);

    // Check for currency pair format (e.g., EUR/USD, eur/usd)
    const forexPairRegex =
      /(\b[a-zA-Z]{3})\b\s*(\/|to|and)\s*(\b[a-zA-Z]{3})\b/i;
    const forexPairMatch = userMessage.match(forexPairRegex);

    // Check for forex exchange rate query with improved pattern
    const forexRegex =
      /what(?:'|')?s the exchange rate (?:from|of|between) ([a-zA-Z]{3}) (?:to|and) ([a-zA-Z]{3})(\?)?|forex (?:between|for) ([a-zA-Z]{3}) (?:and|to) ([a-zA-Z]{3})/i;
    const forexMatch = userMessage.match(forexRegex);

    // Check for crypto price query with improved pattern
    const cryptoRegex =
      /what(?:'|')?s the (?:price|value) of ([a-zA-Z\s]+)(\?)?|([a-zA-Z\s]+) (?:price|value)(\?)?/i;
    const cryptoMatch = userMessage.match(cryptoRegex);

    // Check for stock price query
    const stockRegex =
      /what(?:'|')?s the (?:stock )?price of ([a-zA-Z]{1,5}) stock(\?)?|([a-zA-Z]{1,5}) stock price/i;
    const stockMatch = userMessage.match(stockRegex);

    setIsLoading(true);

    try {
      let botResponse;
      let responseLink = null;
      let responseLinks = null;

      // First check for stock price queries
      if (stockMatch) {
        // Handle stock price query
        const stockSymbol = (stockMatch[1] || stockMatch[3]).toUpperCase();
        const stockData = await fetchStockPrice(stockSymbol);

        if (stockData.price > 0) {
          botResponse = `The current price of ${stockSymbol} is $${stockData.price.toFixed(
            2
          )}. The stock ${
            stockData.change >= 0 ? "increased" : "decreased"
          } by ${Math.abs(stockData.change).toFixed(2)}% today.`;
        } else {
          botResponse = `I couldn't find current price data for ${stockSymbol}. Please check if the stock symbol is correct.`;
        }
      }
      // Then check for forex queries
      else if (forexPairMatch || forexMatch) {
        // Handle forex exchange rate query
        let fromCurrency, toCurrency;

        if (forexPairMatch) {
          fromCurrency = forexPairMatch[1];
          toCurrency = forexPairMatch[3];
        } else if (forexMatch) {
          fromCurrency = forexMatch[1] || forexMatch[4];
          toCurrency = forexMatch[2] || forexMatch[5];
        }

        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

        // Handle special case for Romanian Leu (RON/LEI)
        if (toCurrency === "LEI") {
          toCurrency = "RON";
        }

        if (fromCurrency === "LEI") {
          fromCurrency = "RON";
        }

        const forexData = await fetchForexRate(fromCurrency, toCurrency);

        if (forexData.rate > 0) {
          botResponse = `The current exchange rate from ${fromCurrency} to ${toCurrency} is ${forexData.rate.toFixed(
            4
          )}.`;

          // Only include change if it's meaningful
          if (Math.abs(forexData.change) > 0.0001) {
            botResponse += ` The rate has changed by ${
              forexData.change >= 0 ? "+" : ""
            }${forexData.change.toFixed(4)} today.`;
          }
        } else {
          botResponse = `I couldn't find the exchange rate between ${fromCurrency} and ${toCurrency}. Please check if both currency codes are valid.`;
        }
      }
      // Then check for crypto queries
      else if (cryptoMatch) {
        // Extract the cryptocurrency name
        const cryptoName = (cryptoMatch[1] || cryptoMatch[3])
          .toLowerCase()
          .trim();

        // Map common crypto names/terms to their IDs
        const cryptoMap = {
          bitcoin: "bitcoin",
          btc: "bitcoin",
          ethereum: "ethereum",
          eth: "ethereum",
          cardano: "cardano",
          ada: "cardano",
          "binance coin": "binancecoin",
          bnb: "binancecoin",
          solana: "solana",
          sol: "solana",
          ripple: "ripple",
          xrp: "ripple",
          dogecoin: "dogecoin",
          doge: "dogecoin",
          polkadot: "polkadot",
          dot: "polkadot",
          litecoin: "litecoin",
          ltc: "litecoin",
          chainlink: "chainlink",
          link: "chainlink",
          uniswap: "uniswap",
          uni: "uniswap",
          avalanche: "avalanche-2",
          avax: "avalanche-2",
          polygon: "matic-network",
          matic: "matic-network",
        };

        // Find the crypto ID based on the name
        let cryptoId = null;
        for (const [key, value] of Object.entries(cryptoMap)) {
          if (cryptoName.includes(key)) {
            cryptoId = value;
            break;
          }
        }

        if (cryptoId) {
          const cryptoData = await fetchCryptoPrice(cryptoId);

          if (cryptoData.price > 0) {
            const displayName =
              cryptoId.split("-")[0].charAt(0).toUpperCase() +
              cryptoId.split("-")[0].slice(1);
            botResponse = `The current price of ${displayName} is $${cryptoData.price.toFixed(
              2
            )}. It's ${cryptoData.change >= 0 ? "up" : "down"} ${Math.abs(
              cryptoData.change
            ).toFixed(2)}% in the last 24 hours.`;

            if (cryptoData.marketCap) {
              botResponse += ` Market cap: ${cryptoData.marketCap}.`;
            }
          } else {
            const displayName =
              cryptoId.split("-")[0].charAt(0).toUpperCase() +
              cryptoId.split("-")[0].slice(1);
            botResponse = `I couldn't find current price data for ${displayName}. It may not be listed on the exchanges I have access to.`;
          }
        } else {
          botResponse = `I couldn't identify the cryptocurrency you're asking about. Please try specifying a major cryptocurrency like Bitcoin or Ethereum.`;
        }
      } else {
        // Use OpenRouter for general queries
        const apiUrl =
          process.env.REACT_APP_BACKEND_URL || "http://localhost:8000/api";
        const token = getAccessToken();

        if (!token) {
          throw new Error(
            "Authentication token is missing. Please log in again."
          );
        }

        const response = await axios.post(
          `${apiUrl}/proxy/openrouter/`,
          {
            inputs: userMessage,
            chatHistory: updatedHistory.slice(-10),
            parameters: { temperature: 0.7 },
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        botResponse = response.data.response;

        // Check if the response includes a link or multiple links
        if (response.data.link) {
          responseLink = response.data.link;
        }

        if (response.data.links && Array.isArray(response.data.links)) {
          responseLinks = response.data.links;
        }
      }

      // Add bot response to chat
      const botChatObj = {
        sender: "bot",
        text: botResponse,
        link: responseLink,
        links: responseLinks,
      };
      setMessages((prevMessages) => [...prevMessages, botChatObj]);

      // Add bot response to chat history
      const botHistoryObj = { role: "assistant", content: botResponse };
      setChatHistory([...updatedHistory, botHistoryObj]);

      // Check if text-to-speech is enabled
      if (isSpeechEnabled) {
        handleSpeak(botResponse);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      let errorMessage =
        "Sorry, I couldn't process your request. Please try again.";

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
        } else if (error.response.status === 429) {
          errorMessage =
            "You've reached the rate limit. Please try again in a moment.";
        } else if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "bot", text: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchForexRate = async (from, to) => {
    try {
      // Handle special case for RON/LEI (Romanian Leu)
      if (from === "LEI") from = "RON";
      if (to === "LEI") to = "RON";

      // Ensure currencies are valid 3-letter codes
      if (!from || !to || from.length !== 3 || to.length !== 3) {
        console.error("Invalid currency code format");
        return { rate: 0, change: 0 };
      }

      // First try with freecurrencyapi.com - has broader currency support
      try {
        const freeCurrencyApiKey = process.env.REACT_APP_FREE_CURRENCY_API_KEY;
        if (!freeCurrencyApiKey) {
          console.warn("Free Currency API key not found");
          throw new Error("API key missing");
        }

        const freeApiResponse = await axios.get(
          `https://api.freecurrencyapi.com/v1/latest?apikey=${freeCurrencyApiKey}&base_currency=${from}&currencies=${to}`
        );

        if (
          freeApiResponse.data &&
          freeApiResponse.data.data &&
          freeApiResponse.data.data[to]
        ) {
          const rate = freeApiResponse.data.data[to];
          return { rate, change: 0 }; // API doesn't provide change
        }
      } catch (freeApiError) {
        console.error("Error with freecurrencyapi:", freeApiError);
        // Continue to fallback API
      }

      // Use exchangerate-api.com as fallback
      const exchangeRateApiKey = process.env.REACT_APP_EXCHANGE_RATE_API_KEY;
      if (!exchangeRateApiKey) {
        console.warn("Exchange Rate API key not found");
        throw new Error("API key missing");
      }

      const response = await axios.get(
        `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/pair/${from}/${to}`
      );

      if (!response.data || !response.data.conversion_rate) {
        // Try fallback with reversed order if the API doesn't have the requested base currency
        try {
          const fallbackResponse = await axios.get(
            `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/pair/${to}/${from}`
          );

          if (fallbackResponse.data && fallbackResponse.data.conversion_rate) {
            // Calculate reciprocal rate when using reversed currencies
            const rate = 1 / fallbackResponse.data.conversion_rate;
            return { rate, change: 0 };
          }
        } catch (fallbackError) {
          console.error("Error fetching fallback Forex rates:", fallbackError);
        }

        return { rate: 0, change: 0 };
      }

      const rate = response.data.conversion_rate;

      // Calculate change if possible, otherwise return 0
      let change = 0;
      if (response.data.rates && response.data.rates[from]) {
        // For same currency, the rate should be 1, so change is 0
        if (from === to) {
          change = 0;
        } else {
          // Otherwise calculate the difference
          change = rate - 1;
        }
      }

      return { rate, change };
    } catch (error) {
      console.error("Error fetching Forex rates:", error);
      return { rate: 0, change: 0 };
    }
  };

  const fetchStockPrice = async (symbol) => {
    try {
      // Using Alpha Vantage API for stock data
      const apiKey = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;

      if (!apiKey) {
        console.warn("Alpha Vantage API key not found. Using fallback data.");
        return {
          price: 0,
          change: 0,
          changePercent: "0.00%",
        };
      }

      const response = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );

      // Log the response for debugging
      console.log(`Alpha Vantage response for ${symbol}:`, response.data);

      if (
        response.data &&
        response.data["Global Quote"] &&
        response.data["Global Quote"]["05. price"]
      ) {
        const price = parseFloat(response.data["Global Quote"]["05. price"]);
        const changePercent = parseFloat(
          response.data["Global Quote"]["10. change percent"].replace("%", "")
        );

        if (!price || isNaN(price) || price === 0) {
          console.warn(`Invalid price data received for ${symbol}`);
          return {
            price: 0,
            change: 0,
            changePercent: "0.00%",
          };
        }

        return {
          price,
          change: changePercent,
          changePercent: `${Math.abs(changePercent).toFixed(2)}%`,
        };
      } else {
        console.warn(`No valid data received for ${symbol}`);
        return {
          price: 0,
          change: 0,
          changePercent: "0.00%",
        };
      }
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return {
        price: 0,
        change: 0,
        changePercent: "0.00%",
      };
    }
  };

  const fetchCryptoPrice = async (cryptoId) => {
    try {
      // Normalize crypto ID for API
      const normalizedCryptoId = cryptoId.toLowerCase().trim();

      // Use CoinGecko API for crypto prices
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${normalizedCryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );

      if (response.data[normalizedCryptoId]) {
        const price = response.data[normalizedCryptoId].usd;
        const change = response.data[normalizedCryptoId].usd_24h_change || 0;
        const marketCap = response.data[normalizedCryptoId].usd_market_cap;

        // Format market cap in a readable way
        let formattedMarketCap = null;
        if (marketCap) {
          if (marketCap >= 1000000000) {
            formattedMarketCap = `$${(marketCap / 1000000000).toFixed(2)}B`;
          } else if (marketCap >= 1000000) {
            formattedMarketCap = `$${(marketCap / 1000000).toFixed(2)}M`;
          } else {
            formattedMarketCap = `$${(marketCap / 1000).toFixed(2)}K`;
          }
        }

        return {
          price,
          change,
          changePercent: change ? `${Math.abs(change).toFixed(2)}%` : "0.00%",
          marketCap: formattedMarketCap,
        };
      } else {
        // Try fallback with different API endpoint
        try {
          const coinListResponse = await axios.get(
            `https://api.coingecko.com/api/v3/coins/list`
          );

          const coinMatch = coinListResponse.data.find(
            (coin) =>
              coin.name.toLowerCase() === normalizedCryptoId ||
              coin.symbol.toLowerCase() === normalizedCryptoId
          );

          if (coinMatch) {
            // Use the found coin ID to fetch price data
            const priceResponse = await axios.get(
              `https://api.coingecko.com/api/v3/simple/price?ids=${coinMatch.id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
            );

            if (priceResponse.data[coinMatch.id]) {
              const price = priceResponse.data[coinMatch.id].usd;
              const change =
                priceResponse.data[coinMatch.id].usd_24h_change || 0;
              const marketCap = priceResponse.data[coinMatch.id].usd_market_cap;

              let formattedMarketCap = null;
              if (marketCap) {
                if (marketCap >= 1000000000) {
                  formattedMarketCap = `$${(marketCap / 1000000000).toFixed(
                    2
                  )}B`;
                } else if (marketCap >= 1000000) {
                  formattedMarketCap = `$${(marketCap / 1000000).toFixed(2)}M`;
                } else {
                  formattedMarketCap = `$${(marketCap / 1000).toFixed(2)}K`;
                }
              }

              return {
                price,
                change,
                changePercent: change
                  ? `${Math.abs(change).toFixed(2)}%`
                  : "0.00%",
                marketCap: formattedMarketCap,
              };
            }
          }
        } catch (fallbackError) {
          console.error("Error fetching fallback crypto data:", fallbackError);
        }

        return {
          price: 0,
          change: 0,
          changePercent: "0.00%",
          marketCap: null,
        };
      }
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return {
        price: 0,
        change: 0,
        changePercent: "0.00%",
        marketCap: null,
      };
    }
  };

  const handleSpeak = (text) => {
    if (!selectedVoice) return;

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleQuickReplyClick = (replyText) => {
    // Send the quick reply message immediately
    handleMessageSend(replyText);
  };

  return (
    <div className="chatbot">
      {!isMobile && (
        <button
          className="chatbot-toggle btn-accent"
          onClick={() => onClose(!isVisible)}
          aria-label="Open Finance Assistant"
        >
          💰
        </button>
      )}

      {isMobile && isVisible && (
        <div
          className="chatbot-overlay"
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 1099,
          }}
        />
      )}

      <div
        className={`chatbot-container ${isVisible ? "active" : ""} shadow-lg`}
        style={{
          ...(isMobile &&
            isVisible && {
              position: "fixed",
              bottom: 0,
              right: 0,
              width: "100%",
              height: "75vh",
              maxWidth: "100vw",
              borderRadius: "12px 12px 0 0",
              transform: "translateY(0)",
              zIndex: 1100,
            }),
        }}
      >
        <div className="chatbot-header d-flex align-items-center justify-content-between">
          <span className="fw-semibold">Finance Assistant</span>
          <button
            className="btn btn-link text-accent p-0"
            onClick={onClose}
            aria-label="Close Finance Assistant"
          >
            ✖
          </button>
        </div>

        <div className="tts-toggle-container px-3 py-2 d-flex align-items-center">
          <label className="switch me-2">
            <input
              type="checkbox"
              onChange={() => setIsSpeechEnabled(!isSpeechEnabled)}
              checked={isSpeechEnabled}
            />
            <span className="slider"></span>
          </label>
          <span className="text-muted">🔊 Speak Answers</span>

          {isSpeechEnabled && (
            <div className="d-flex align-items-center ms-auto">
              <select
                className="form-select form-select-sm me-2"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{ maxWidth: "120px" }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                onChange={(e) =>
                  setSelectedVoice(
                    voices.find((v) => v.name === e.target.value)
                  )
                }
                value={selectedVoice?.name || ""}
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
          )}
        </div>

        <div className="chat-history p-3" ref={messagesEndRef}>
          {messages.map((msg, idx) => (
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
              <div className="message-content d-flex align-items-start">
                <div className="message-icon me-2">
                  {msg.sender === "user" ? (
                    <img
                      src={userAvatar}
                      alt="User Avatar"
                      className="user-avatar"
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : msg.sender === "bot" ? (
                    "🤖"
                  ) : (
                    "⚙️"
                  )}
                </div>
                <div className="message-text">
                  {msg.text}
                  {msg.link && (
                    <div className="course-link mt-2">
                      <button
                        className="btn btn-sm btn-accent"
                        onClick={() => handleCourseClick(msg.link.path)}
                      >
                        {msg.link.icon || "📚"} {msg.link.text}
                      </button>
                    </div>
                  )}
                  {msg.links && msg.links.length > 0 && (
                    <div className="course-links mt-2">
                      <p className="mb-1 fs-6">Available paths:</p>
                      <div className="d-flex flex-wrap gap-2">
                        {msg.links.map((link, linkIdx) => (
                          <button
                            key={linkIdx}
                            className="btn btn-sm btn-accent"
                            onClick={() => handleCourseClick(link.path)}
                          >
                            {link.icon || "📚"} {link.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.sender === "bot" && isSpeaking && (
                  <div className="speaking-indicator ms-2">🔊</div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-bot typing-animation p-3 rounded">
              <div className="message-content d-flex align-items-start">
                <div className="message-icon me-2">🤖</div>
                <div className="message-text">Typing...</div>
              </div>
            </div>
          )}

          {/* Quick Replies - Show when chat is empty or only has greeting */}
          {messages.length <= 1 && (
            <div className="chat-message chat-bot p-3 rounded">
              <div className="message-content d-flex align-items-start">
                <div className="message-icon me-2">🤖</div>
                <div className="message-text">
                  <p>Try asking me about:</p>
                  <div className="quick-replies">
                    {quickReplies.map((reply, index) => (
                      <button
                        key={index}
                        className="quick-reply-button"
                        onClick={() => handleQuickReplyClick(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-container d-flex gap-2 p-3">
          <button
            className="btn btn-accent voice-button rounded-circle p-2"
            onClick={startVoiceRecognition}
            aria-label="Voice Input"
          >
            🎙
          </button>
          <input
            type="text"
            className="form-control rounded-pill"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMessageSend()}
            placeholder="Ask me about finance, budgeting, investing..."
            aria-label="Chat input"
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
