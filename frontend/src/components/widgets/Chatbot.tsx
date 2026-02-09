import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import UpsellModal from "components/billing/UpsellModal";
import { fetchEntitlements } from "services/entitlementsService";
import { BACKEND_URL } from "services/backendUrl";
import { queryKeys, staleTimes } from "lib/reactQuery";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import { formatCurrency, formatNumber, getLocale } from "utils/format";

const Chatbot = () => {
  const { t } = useTranslation();
  const LANGUAGES = [
    { code: "en-US", name: t("chatbot.languages.enUS") },
    { code: "es-ES", name: t("chatbot.languages.esES") },
    { code: "fr-FR", name: t("chatbot.languages.frFR") },
    { code: "de-DE", name: t("chatbot.languages.deDE") },
    { code: "it-IT", name: t("chatbot.languages.itIT") },
    { code: "pt-BR", name: t("chatbot.languages.ptBR") },
    { code: "ja-JP", name: t("chatbot.languages.jaJP") },
    { code: "ko-KR", name: t("chatbot.languages.koKR") },
    { code: "zh-CN", name: t("chatbot.languages.zhCN") },
  ];
  const locale = getLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [userAvatar, setUserAvatar] = useState(DEFAULT_AVATAR_URL);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);
  const [lockedFeature, setLockedFeature] = useState(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const messagesEndRef = useRef(null);
  const { getAccessToken, isInitialized, isAuthenticated, loadProfile } =
    useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: entitlementResponse } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: fetchEntitlements,
    staleTime: staleTimes.entitlements,
    enabled: isAuthenticated });

  const quickReplies = [
    t("chatbot.quickReplies.compoundInterest"),
    t("chatbot.quickReplies.learningPaths"),
    t("chatbot.quickReplies.recommendCourse"),
    t("chatbot.quickReplies.bitcoinPrice"),
    t("chatbot.quickReplies.startInvesting"),
  ];

  const aiTutorFeature = entitlementResponse?.data?.features?.ai_tutor;

  const blockAiTutor = (message) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        sender: "bot",
        text:
          message ||
          t("chatbot.aiTutorLimited") },
    ]);
    setLockedFeature("ai_tutor");
    setShowUpsell(true);
  };

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
          text: t("chatbot.greeting") },
      ]);
      setHasGreeted(true);
    }
  }, [hasGreeted, t]);

  useEffect(() => {
    const handleTutorOpen = (event) => {
      const context = event?.detail?.context;
      setIsOpen(true);
      if (typeof context === "string" && context.trim().length > 0) {
        setInputMessage(context);
      }
    };

    window.addEventListener("monevo:tutor", handleTutorOpen);
    return () => {
      window.removeEventListener("monevo:tutor", handleTutorOpen);
    };
  }, []);

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
          setUserAvatar(String(avatar));
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
      alert(t("chatbot.speechNotSupported"));
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
      { sender: "system", text: t("chatbot.listening") },
    ]);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setMessages((prev) =>
        prev.filter((msg) => msg.text !== t("chatbot.listening"))
      );
      handleMessageSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setMessages((prev) =>
        prev.filter((msg) => msg.text !== t("chatbot.listening"))
      );
    };
  };

  const handleMessageSend = async (message = null) => {
    if (!isAuthenticated) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: "bot",
          text: t("chatbot.loginRequired") },
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

    if (aiTutorFeature) {
      if (!aiTutorFeature.enabled) {
        blockAiTutor(
          t("chatbot.aiTutorPremiumOnly")
        );
        return;
      }

      if (aiTutorFeature.remaining_today === 0) {
        blockAiTutor(
          t("chatbot.aiTutorDailyLimit")
        );
        return;
      }
    }

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
          const priceLabel = formatCurrency(stockData.price, "USD", locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 });
          const changeLabel = formatNumber(Math.abs(stockData.change), locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 });
          botResponse = t("chatbot.responses.stockPrice", {
            symbol: stockSymbol,
            price: priceLabel,
            direction:
              stockData.change >= 0
                ? t("chatbot.responses.increased")
                : t("chatbot.responses.decreased"),
            change: changeLabel });
        } else {
          botResponse = t("chatbot.responses.stockNotFound", {
            symbol: stockSymbol });
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
          const rateLabel = formatNumber(forexData.rate, locale, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4 });
          botResponse = t("chatbot.responses.forexRate", {
            from: fromCurrency,
            to: toCurrency,
            rate: rateLabel });

          if (Math.abs(forexData.change) > 0.0001) {
            const changeLabel = formatNumber(forexData.change, locale, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4 });
            botResponse += ` ${t("chatbot.responses.forexChanged", {
              sign: forexData.change >= 0 ? "+" : "",
              change: changeLabel })}`;
          }
        } else {
          botResponse = t("chatbot.responses.forexNotFound", {
            from: fromCurrency,
            to: toCurrency });
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
          matic: "matic-network" };

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
            const priceLabel = formatCurrency(cryptoData.price, "USD", locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 });
            const changeLabel = formatNumber(
              Math.abs(cryptoData.change),
              locale,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 }
            );
            botResponse = t("chatbot.responses.cryptoPrice", {
              name: displayName,
              price: priceLabel,
              direction:
                cryptoData.change >= 0
                  ? t("chatbot.responses.up")
                  : t("chatbot.responses.down"),
              change: changeLabel });

            if (cryptoData.marketCap) {
              botResponse += ` ${t("chatbot.responses.marketCap", {
                marketCap: cryptoData.marketCap })}`;
            }
          } else {
            const displayName =
              cryptoId.split("-")[0].charAt(0).toUpperCase() +
              cryptoId.split("-")[0].slice(1);
            botResponse = t("chatbot.responses.cryptoNotFound", {
              name: displayName });
          }
        } else {
          botResponse = t("chatbot.responses.cryptoUnrecognized");
        }
      } else {
        const apiUrl = BACKEND_URL;
        const token = getAccessToken();

        if (!token) {
          throw new Error(
            t("chatbot.authTokenMissing")
          );
        }

        const response = await axios.post(
          `${apiUrl}/proxy/openrouter/`,
          {
            inputs: userMessage,
            chatHistory: updatedHistory.slice(-10),
            parameters: { temperature: 0.7 } },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}` } }
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
        links: responseLinks };
      setMessages((prevMessages) => [...prevMessages, botChatObj]);

      const botHistoryObj = { role: "assistant", content: botResponse };
      setChatHistory([...updatedHistory, botHistoryObj]);

      if (isSpeechEnabled) {
        handleSpeak(botResponse);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      let errorMessage =
        t("chatbot.genericError");

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = t("chatbot.sessionExpired");
        } else if (
          [402, 429].includes(error.response.status) &&
          error.response.data?.flag === "feature.ai.tutor"
        ) {
          errorMessage =
            error.response.data?.error ||
              t("chatbot.aiTutorDailyLimit");
          blockAiTutor(errorMessage);
          return;
        } else if (error.response.status === 429) {
          errorMessage =
            t("chatbot.rateLimit");
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
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
      }
    }
  };

  const fetchForexRate = async (from, to) => {
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("Authentication token is missing");
      }

      const response = await axios.get(`${BACKEND_URL}/forex-rate/`, {
        params: { from, to },
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` } });

      const { rate = 0, change = 0 } = response.data || {};
      return { rate, change };
    } catch (error) {
      console.error("Error fetching Forex rates:", error);
      return { rate: 0, change: 0 };
    }
  };

  const fetchStockPrice = async (symbol) => {
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("Authentication token is missing");
      }

      const response = await axios.get(`${BACKEND_URL}/stock-price/`, {
        params: { symbol },
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` } });

      const {
        price = 0,
        change = 0,
        changePercent = "0.00%" } = response.data || {};

      return {
        price,
        change,
        changePercent };
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return {
        price: 0,
        change: 0,
        changePercent: "0.00%" };
    }
  };

  const fetchCryptoPrice = async (cryptoId) => {
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("Authentication token is missing");
      }

      const response = await axios.get(`${BACKEND_URL}/crypto-price/`, {
        params: { id: cryptoId },
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` } });

      const { price = 0, change = 0, marketCap = 0 } = response.data || {};

      let formattedMarketCap = null;
      if (marketCap) {
        if (marketCap >= 1000000000) {
          formattedMarketCap = `${formatCurrency(
            marketCap / 1000000000,
            "USD",
            locale,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}B`;
        } else if (marketCap >= 1000000) {
          formattedMarketCap = `${formatCurrency(
            marketCap / 1000000,
            "USD",
            locale,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}M`;
        } else {
          formattedMarketCap = formatCurrency(marketCap, "USD", locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 });
        }
      }

      return { price, change, marketCap: formattedMarketCap };
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return { price: 0, change: 0, marketCap: null };
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
          isOpen
            ? t("chatbot.closeAssistantAria")
            : t("chatbot.openAssistantAria")
        }
        className="fixed bottom-6 right-6 z-[1100] group inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/80 backdrop-blur-md border border-[color:var(--border-color,rgba(255,255,255,0.2))] text-white text-lg transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 shadow-sm sm:bottom-8 sm:right-8 touch-manipulation"
        style={{
          WebkitTapHighlightColor: "transparent",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)" }}
      >
        <span className="transition group-hover:-translate-y-1">💬</span>
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[1100] flex max-h-[70vh] w-[min(90vw,420px)] flex-col overflow-hidden rounded-3xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)" }}
        >
          <header className="flex items-center justify-between border-b border-[color:var(--border-color,rgba(0,0,0,0.1))] px-5 py-4">
            <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
              {t("chatbot.title")}
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
                    <option>{t("chatbot.loadingVoices")}</option>
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
                          alt={t("chatbot.userAvatarAlt")}
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
                              {t("chatbot.availablePaths")}
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
                    <span>{t("chatbot.typing")}</span>
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
                        {t("chatbot.tryAsking")}
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
              aria-label={t("chatbot.voiceInputAria")}
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
              placeholder={t("chatbot.inputPlaceholder")}
              className="h-10 flex-1 min-w-0 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              aria-label={t("chatbot.chatInputAria")}
            />
            <button
              type="button"
              onClick={() => handleMessageSend()}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              {t("chatbot.send")}
            </button>
          </div>
        </div>
      )}
      <UpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
        feature={lockedFeature || "ai_tutor"}
      />
    </>
  );
};

export default Chatbot;
