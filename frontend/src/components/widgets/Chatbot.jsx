import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

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

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [userAvatar, setUserAvatar] = useState("/default-avatar.png");
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);

  const messagesEndRef = useRef(null);
  const { getAccessToken, isInitialized, isAuthenticated, loadProfile } =
    useAuth();
  const navigate = useNavigate();

  const quickReplies = [
    "💰 What is compound interest?",
    "📚 Show me learning paths",
    "📊 Recommend a course for me",
    "📈 What's the price of Bitcoin?",
    "💼 How do I start investing?",
  ];

  const handleCourseClick = (path) => {
    setIsOpen(false);

    if (path.includes("#")) {
      const [basePath, anchor] = path.split("#");
      sessionStorage.setItem("scrollToPathId", anchor);
      navigate(basePath);
    } else {
      navigate(path);
    }
  };

  useEffect(() => {
    if (!hasGreeted) {
      setMessages([
        {
          sender: "bot",
          text: "Hello! I'm your financial assistant. Ask me about budgeting, investing, saving, cryptocurrencies, retirement planning, or any other finance topic. How can I help you today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [hasGreeted]);

  // Removed mobile/visibility side-effects

  useEffect(() => {
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
            prev ||
            availableVoices.find((voice) => voice.default) ||
            availableVoices[0]
        );
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, [voices.length]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const fetchUserAvatar = async () => {
      try {
        const profilePayload = await loadProfile();
        const avatar =
          profilePayload?.profile_avatar ||
          profilePayload?.user_data?.profile_avatar ||
          null;
        if (avatar) {
          setUserAvatar(avatar);
        }
      } catch (error) {
        console.error("Error fetching user avatar:", error);
      }
    };

    fetchUserAvatar();
  }, [isInitialized, isAuthenticated, loadProfile]);

  const startVoiceRecognition = () => {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setMessages((prev) => [
      ...prev,
      { sender: "system", text: "Listening..." },
    ]);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setMessages((prev) => prev.filter((msg) => msg.text !== "Listening..."));
      handleMessageSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
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

    const userChatObj = { sender: "user", text: userMessage };
    setMessages((prevMessages) => [...prevMessages, userChatObj]);

    const userHistoryObj = { role: "user", content: userMessage };
    const updatedHistory = [...chatHistory, userHistoryObj];
    setChatHistory(updatedHistory);

    const forexPairRegex =
      /(\b[a-zA-Z]{3})\b\s*(\/|to|and)\s*(\b[a-zA-Z]{3})\b/i;
    const forexPairMatch = userMessage.match(forexPairRegex);

    const forexRegex =
      /what(?:'|')?s the exchange rate (?:from|of|between) ([a-zA-Z]{3}) (?:to|and) ([a-zA-Z]{3})(\?)?|forex (?:between|for) ([a-zA-Z]{3}) (?:and|to) ([a-zA-Z]{3})/i;
    const forexMatch = userMessage.match(forexRegex);

    const cryptoRegex =
      /what(?:'|')?s the (?:price|value) of ([a-zA-Z\s]+)(\?)?|([a-zA-Z\s]+) (?:price|value)(\?)?/i;
    const cryptoMatch = userMessage.match(cryptoRegex);

    const stockRegex =
      /what(?:'|')?s the (?:stock )?price of ([a-zA-Z]{1,5}) stock(\?)?|([a-zA-Z]{1,5}) stock price/i;
    const stockMatch = userMessage.match(stockRegex);

    setIsLoading(true);

    try {
      let botResponse;
      let responseLink = null;
      let responseLinks = null;

      if (stockMatch) {
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
      } else if (forexPairMatch || forexMatch) {
        let fromCurrency;
        let toCurrency;

        if (forexPairMatch) {
          fromCurrency = forexPairMatch[1];
          toCurrency = forexPairMatch[3];
        } else if (forexMatch) {
          fromCurrency = forexMatch[1] || forexMatch[4];
          toCurrency = forexMatch[2] || forexMatch[5];
        }

        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

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

          if (Math.abs(forexData.change) > 0.0001) {
            botResponse += ` The rate has changed by ${
              forexData.change >= 0 ? "+" : ""
            }${forexData.change.toFixed(4)} today.`;
          }
        } else {
          botResponse = `I couldn't find the exchange rate between ${fromCurrency} and ${toCurrency}. Please check if both currency codes are valid.`;
        }
      } else if (cryptoMatch) {
        const cryptoName = (cryptoMatch[1] || cryptoMatch[3])
          .toLowerCase()
          .trim();

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

        if (response.data.link) {
          responseLink = response.data.link;
        }

        if (response.data.links && Array.isArray(response.data.links)) {
          responseLinks = response.data.links;
        }
      }

      const botChatObj = {
        sender: "bot",
        text: botResponse,
        link: responseLink,
        links: responseLinks,
      };
      setMessages((prevMessages) => [...prevMessages, botChatObj]);

      const botHistoryObj = { role: "assistant", content: botResponse };
      setChatHistory([...updatedHistory, botHistoryObj]);

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
      if (from === "LEI") from = "RON";
      if (to === "LEI") to = "RON";

      if (!from || !to || from.length !== 3 || to.length !== 3) {
        console.error("Invalid currency code format");
        return { rate: 0, change: 0 };
      }

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
          return { rate, change: 0 };
        }
      } catch (freeApiError) {
        console.error("Error with freecurrencyapi:", freeApiError);
      }

      const exchangeRateApiKey = process.env.REACT_APP_EXCHANGE_RATE_API_KEY;
      if (!exchangeRateApiKey) {
        console.warn("Exchange Rate API key not found");
        throw new Error("API key missing");
      }

      const response = await axios.get(
        `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/pair/${from}/${to}`
      );

      if (!response.data || !response.data.conversion_rate) {
        try {
          const fallbackResponse = await axios.get(
            `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/pair/${to}/${from}`
          );

          if (fallbackResponse.data && fallbackResponse.data.conversion_rate) {
            const rate = 1 / fallbackResponse.data.conversion_rate;
            return { rate, change: 0 };
          }
        } catch (fallbackError) {
          console.error("Error fetching fallback Forex rates:", fallbackError);
        }

        return { rate: 0, change: 0 };
      }

      const rate = response.data.conversion_rate;

      let change = 0;
      if (response.data.rates && response.data.rates[from]) {
        if (from === to) {
          change = 0;
        } else {
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

      if (
        response.data &&
        response.data["Global Quote"] &&
        response.data["Global Quote"]["05. price"]
      ) {
        const price = parseFloat(response.data["Global Quote"]["05. price"]);
        const changePercent = parseFloat(
          response.data["Global Quote"]["10. change percent"].replace("%", "")
        );

        if (!price || Number.isNaN(price) || price === 0) {
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
      }

      console.warn(`No valid data received for ${symbol}`);
      return {
        price: 0,
        change: 0,
        changePercent: "0.00%",
      };
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
      const normalizedCryptoId = cryptoId.toLowerCase().trim();

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${normalizedCryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );

      if (response.data[normalizedCryptoId]) {
        const price = response.data[normalizedCryptoId].usd;
        const change = response.data[normalizedCryptoId].usd_24h_change || 0;
        const marketCap = response.data[normalizedCryptoId].usd_market_cap;

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
      }

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
          const priceResponse = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinMatch.id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
          );

          if (priceResponse.data[coinMatch.id]) {
            const price = priceResponse.data[coinMatch.id].usd;
            const change = priceResponse.data[coinMatch.id].usd_24h_change || 0;
            const marketCap = priceResponse.data[coinMatch.id].usd_market_cap;

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
    handleMessageSend(replyText);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen ? "Close Finance Assistant" : "Open Finance Assistant"
        }
        className="fixed bottom-6 right-6 z-[1100] group inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/80 backdrop-blur-md border border-[color:var(--border-color,rgba(255,255,255,0.2))] text-white text-lg transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 shadow-sm sm:bottom-8 sm:right-8 touch-manipulation"
        style={{
          WebkitTapHighlightColor: "transparent",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span className="transition group-hover:-translate-y-1">💬</span>
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[1100] flex max-h-[70vh] w-[min(90vw,420px)] flex-col overflow-hidden rounded-3xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <header className="flex items-center justify-between border-b border-[color:var(--border-color,rgba(0,0,0,0.1))] px-5 py-4">
            <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
              Finance Assistant
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full bg-transparent px-3 py-1 text-sm text-[color:var(--muted-text,#6b7280)] transition hover:bg-[color:var(--input-bg,#f3f4f6)]/50 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              ✕
            </button>
          </header>

          <div className="flex items-center gap-2 border-b border-[color:var(--border-color,rgba(0,0,0,0.1))] px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]/40"
                onChange={() => setIsSpeechEnabled((prev) => !prev)}
                checked={isSpeechEnabled}
              />
              <span className="text-xs uppercase tracking-wide">
                🔊 Speak answers
              </span>
            </label>

            {isSpeechEnabled && (
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-1 text-xs text-[color:var(--muted-text,#6b7280)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedVoice?.name || ""}
                  onChange={(event) =>
                    setSelectedVoice(
                      voices.find((voice) => voice.name === event.target.value)
                    )
                  }
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-1 text-xs text-[color:var(--muted-text,#6b7280)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                >
                  {voices.length > 0 ? (
                    voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
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

          <div
            ref={messagesEndRef}
            className="flex-1 overflow-y-auto bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm"
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={[
                  "mb-3 flex",
                  msg.sender === "user"
                    ? "justify-end"
                    : msg.sender === "system"
                    ? "justify-center"
                    : "justify-start",
                ].join(" ")}
              >
                {msg.sender === "user" ? (
                  <div className="max-w-[80%] rounded-2xl bg-[color:var(--primary,#1d5330)] px-4 py-3 text-white shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="shrink-0">
                        <img
                          src={userAvatar}
                          alt="User avatar"
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      </div>
                      <div className="space-y-3">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  </div>
                ) : msg.sender === "system" ? (
                  <GlassCard
                    padding="sm"
                    className="max-w-[80%] bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]"
                  >
                    <div className="flex items-start gap-2">
                      <div className="shrink-0">
                        <span>⚙️</span>
                      </div>
                      <div className="space-y-3">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard
                    padding="sm"
                    className="max-w-[80%] text-[color:var(--text-color,#111827)]"
                  >
                    <div className="flex items-start gap-2">
                      <div className="shrink-0">
                        <span>🤖</span>
                      </div>
                      <div className="space-y-3">
                        <p>{msg.text}</p>
                        {msg.link && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary,#1d5330)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
                            onClick={() => handleCourseClick(msg.link.path)}
                          >
                            {msg.link.icon || "📚"} {msg.link.text}
                          </button>
                        )}
                        {msg.links && msg.links.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase text-[color:var(--muted-text,#6b7280)]">
                              Available paths
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.links.map((link, linkIndex) => (
                                <button
                                  key={linkIndex}
                                  type="button"
                                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary,#1d5330)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
                                  onClick={() => handleCourseClick(link.path)}
                                >
                                  {link.icon || "📚"} {link.text}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {isSpeaking && (
                        <div className="text-xs text-[color:var(--muted-text,#6b7280)]">
                          🔊
                        </div>
                      )}
                    </div>
                  </GlassCard>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="mb-3 flex justify-start">
                <GlassCard
                  padding="sm"
                  className="text-sm text-[color:var(--muted-text,#6b7280)]"
                >
                  <div className="flex items-center gap-2">
                    <span>🤖</span>
                    <span>Typing...</span>
                  </div>
                </GlassCard>
              </div>
            )}
            {messages.length <= 1 && (
              <div className="mb-3 flex justify-start">
                <GlassCard
                  padding="sm"
                  className="text-sm text-[color:var(--text-color,#111827)]"
                >
                  <div className="flex items-start gap-2">
                    <span>🤖</span>
                    <div className="space-y-2">
                      <p className="text-[color:var(--muted-text,#6b7280)]">
                        Try asking me about:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickReplies.map((reply, replyIndex) => (
                          <button
                            key={replyIndex}
                            type="button"
                            className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:border-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
                            onClick={() => handleQuickReplyClick(reply)}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] px-3 py-2.5">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/10 text-lg text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              onClick={startVoiceRecognition}
              aria-label="Voice input"
            >
              🎙
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && handleMessageSend()
              }
              placeholder="Ask me about finance, budgeting, investing..."
              className="h-10 flex-1 min-w-0 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              aria-label="Chat input"
            />
            <button
              type="button"
              onClick={() => handleMessageSend()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
