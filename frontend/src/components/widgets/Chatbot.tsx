import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import UpsellModal from "components/billing/UpsellModal";
import { fetchEntitlements } from "services/entitlementsService";
import apiClient from "services/httpClient";
import { queryKeys, staleTimes } from "lib/reactQuery";
import { formatCurrency, formatNumber, getLocale } from "utils/format";
import { GarzoniIcon } from "components/ui/garzoniIcons";

// ── Regex patterns (shared logic with mobile) ────────────────────────────────
const FOREX_PAIR_RE = /(\b[a-zA-Z]{3})\b\s*(\/|to|and)\s*(\b[a-zA-Z]{3})\b/i;
const FOREX_RE =
  /what(?:'|')?s the exchange rate (?:from|of|between) ([a-zA-Z]{3}) (?:to|and) ([a-zA-Z]{3})(\?)?|forex (?:between|for) ([a-zA-Z]{3}) (?:and|to) ([a-zA-Z]{3})/i;
const CRYPTO_RE =
  /what(?:'|')?s the (?:price|value) of ([a-zA-Z\s]+?)(?:\s+(?:today|now|right now|currently))?(\?)?$|([a-zA-Z\s]+?) (?:price|value)(?:\s+(?:today|now|right now|currently))?(\?)?/i;
const STOCK_RE =
  /what(?:'|')?s the (?:stock )?price of ([a-zA-Z]{1,5}) stock(\?)?|([a-zA-Z]{1,5}) stock price/i;
const TIME_RE =
  /\b(what(?:'s|'s)?\s+(?:the\s+)?(?:current\s+)?time|what\s+time\s+is\s+it|current\s+time|time\s+now)\b/i;
const DATE_RE =
  /\b(what(?:'s|'s)?\s+(?:the\s+)?(?:today'?s?\s+)?date|today'?s?\s+date|what\s+day\s+is\s+(?:it|today))\b/i;

const CRYPTO_TYPOS: Record<string, string> = {
  bircoin: "bitcoin",
  bitcon: "bitcoin",
  "bit coin": "bitcoin",
  bictoin: "bitcoin",
  etherum: "ethereum",
  ethreum: "ethereum",
};

const CRYPTO_MAP: Record<string, string> = {
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

function resolveCryptoId(raw: string): string | null {
  const lower = (CRYPTO_TYPOS[raw] || raw).toLowerCase();
  for (const [key, value] of Object.entries(CRYPTO_MAP)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

// ── Bot message "G" avatar ────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d5330] text-[11px] font-bold text-white">
      G
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const Chatbot = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [lockedFeature, setLockedFeature] = useState(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getAccessToken, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: entitlementResponse } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: fetchEntitlements,
    staleTime: staleTimes.entitlements,
    enabled: isAuthenticated,
  });

  const quickReplies = [
    t("chatbot.quickReplies.compoundInterest"),
    t("chatbot.quickReplies.learningPaths"),
    t("chatbot.quickReplies.recommendCourse"),
    t("chatbot.quickReplies.bitcoinPrice"),
    t("chatbot.quickReplies.startInvesting"),
  ];

  const aiTutorFeature = entitlementResponse?.data?.features?.ai_tutor;

  const blockAiTutor = (message) => {
    setMessages((prev) => [
      ...prev,
      { sender: "bot", text: message || t("chatbot.aiTutorLimited") },
    ]);
    setLockedFeature("ai_tutor");
    setShowUpsell(true);
  };

  const handleCourseClick = (path) => {
    setIsOpen(false);
    if (path?.includes("#")) {
      const [basePath, anchor] = path.split("#");
      const anchorId = (anchor || "").trim();
      if (anchorId) sessionStorage.setItem("scrollToPathId", anchorId);
      navigate(basePath, {
        state: { scrollToPathId: anchorId },
        replace: false,
      });
    } else if (path) {
      navigate(path);
    }
  };

  useEffect(() => {
    if (!hasGreeted) {
      setMessages([{ sender: "bot", text: t("chatbot.greeting") }]);
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
    window.addEventListener("garzoni:tutor", handleTutorOpen);
    return () => window.removeEventListener("garzoni:tutor", handleTutorOpen);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const fetchForexRate = async (from: string, to: string) => {
    try {
      const response = await apiClient.get("/forex-rate/", {
        params: { from, to },
      });
      const { rate = 0, change = 0 } = response.data || {};
      return { rate, change };
    } catch {
      return { rate: 0, change: 0 };
    }
  };

  const fetchStockPrice = async (symbol: string) => {
    try {
      const response = await apiClient.get("/stock-price/", {
        params: { symbol },
      });
      const {
        price = 0,
        change = 0,
        changePercent = "0.00%",
      } = response.data || {};
      return { price, change, changePercent };
    } catch {
      return { price: 0, change: 0, changePercent: "0.00%" };
    }
  };

  const fetchCryptoPrice = async (cryptoId: string) => {
    try {
      const response = await apiClient.get("/crypto-price/", {
        params: { id: cryptoId },
      });
      const { price = 0, change = 0, marketCap = 0 } = response.data || {};
      let formattedMarketCap = null;
      if (marketCap >= 1_000_000_000) {
        formattedMarketCap = `${formatCurrency(marketCap / 1e9, "USD", locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
      } else if (marketCap >= 1_000_000) {
        formattedMarketCap = `${formatCurrency(marketCap / 1e6, "USD", locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
      }
      return { price, change, marketCap: formattedMarketCap };
    } catch {
      return { price: 0, change: 0, marketCap: null };
    }
  };

  const handleMessageSend = async (message = null) => {
    if (!isAuthenticated) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: t("chatbot.loginRequired") },
      ]);
      navigate("/login");
      return;
    }

    const userMessage = message || inputMessage;
    if (!userMessage.trim()) return;
    setInputMessage("");

    const userChatObj = { sender: "user", text: userMessage };
    setMessages((prev) => [...prev, userChatObj]);

    const userHistoryObj = { role: "user", content: userMessage };
    const updatedHistory = [...chatHistory, userHistoryObj];
    setChatHistory(updatedHistory);

    if (aiTutorFeature) {
      if (!aiTutorFeature.enabled) {
        blockAiTutor(t("chatbot.aiTutorPremiumOnly"));
        return;
      }
      if (aiTutorFeature.remaining_today === 0) {
        blockAiTutor(t("chatbot.aiTutorDailyLimit"));
        return;
      }
    }

    setIsLoading(true);

    try {
      let botResponse: string;
      let responseLink = null;
      let responseLinks = null;

      // ── Client-side time / date ──────────────────────────────────────────
      if (TIME_RE.test(userMessage)) {
        const now = new Date();
        botResponse = `It's currently ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} in your local time.`;
      } else if (DATE_RE.test(userMessage)) {
        botResponse = `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
      }
      // ── Stock ─────────────────────────────────────────────────────────────
      else if (STOCK_RE.test(userMessage)) {
        const stockMatch = userMessage.match(STOCK_RE)!;
        const symbol = (stockMatch[1] || stockMatch[3]).toUpperCase();
        const stockData = await fetchStockPrice(symbol);
        if (stockData.price > 0) {
          botResponse = t("chatbot.responses.stockPrice", {
            symbol,
            price: formatCurrency(stockData.price, "USD", locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            direction:
              stockData.change >= 0
                ? t("chatbot.responses.increased")
                : t("chatbot.responses.decreased"),
            change: formatNumber(Math.abs(stockData.change), locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          });
        } else {
          botResponse = t("chatbot.responses.stockNotFound", { symbol });
        }
      }
      // ── Forex ─────────────────────────────────────────────────────────────
      else if (FOREX_PAIR_RE.test(userMessage) || FOREX_RE.test(userMessage)) {
        const forexPairMatch = userMessage.match(FOREX_PAIR_RE);
        const forexMatch = userMessage.match(FOREX_RE);
        let from = forexPairMatch
          ? forexPairMatch[1]
          : forexMatch![1] || forexMatch![4];
        let to = forexPairMatch
          ? forexPairMatch[3]
          : forexMatch![2] || forexMatch![5];
        from = from.toUpperCase() === "LEI" ? "RON" : from.toUpperCase();
        to = to.toUpperCase() === "LEI" ? "RON" : to.toUpperCase();
        const forexData = await fetchForexRate(from, to);
        if (forexData.rate > 0) {
          const rateLabel = formatNumber(forexData.rate, locale, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          });
          botResponse = t("chatbot.responses.forexRate", {
            from,
            to,
            rate: rateLabel,
          });
          if (Math.abs(forexData.change) > 0.0001) {
            botResponse += ` ${t("chatbot.responses.forexChanged", {
              sign: forexData.change >= 0 ? "+" : "",
              change: formatNumber(forexData.change, locale, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              }),
            })}`;
          }
        } else {
          botResponse = t("chatbot.responses.forexNotFound", { from, to });
        }
      }
      // ── Crypto ────────────────────────────────────────────────────────────
      else if (CRYPTO_RE.test(userMessage)) {
        const cryptoMatch = userMessage.match(CRYPTO_RE)!;
        const rawName = ((cryptoMatch[1] || cryptoMatch[3]) ?? "")
          .toLowerCase()
          .trim();
        const cryptoId = resolveCryptoId(rawName);
        if (cryptoId) {
          const cryptoData = await fetchCryptoPrice(cryptoId);
          const displayName =
            cryptoId.split("-")[0].charAt(0).toUpperCase() +
            cryptoId.split("-")[0].slice(1);
          if (cryptoData.price > 0) {
            botResponse = t("chatbot.responses.cryptoPrice", {
              name: displayName,
              price: formatCurrency(cryptoData.price, "USD", locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              direction:
                cryptoData.change >= 0
                  ? t("chatbot.responses.up")
                  : t("chatbot.responses.down"),
              change: formatNumber(Math.abs(cryptoData.change), locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            });
            if (cryptoData.marketCap) {
              botResponse += ` ${t("chatbot.responses.marketCap", { marketCap: cryptoData.marketCap })}`;
            }
          } else {
            botResponse = t("chatbot.responses.cryptoNotFound", {
              name: displayName,
            });
          }
        } else {
          botResponse = t("chatbot.responses.cryptoUnrecognized");
        }
      }
      // ── AI backend ───────────────────────────────────────────────────────
      else {
        const token = getAccessToken();
        if (!token) throw new Error(t("chatbot.authTokenMissing"));
        const response = await apiClient.post("/proxy/openai/", {
          inputs: userMessage,
          chatHistory: updatedHistory.slice(-10),
          parameters: { temperature: 0.7 },
        });
        botResponse = response.data.response;
        if (response.data.link) responseLink = response.data.link;
        if (Array.isArray(response.data.links))
          responseLinks = response.data.links;
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: botResponse,
          link: responseLink,
          links: responseLinks,
        },
      ]);
      setChatHistory([
        ...updatedHistory,
        { role: "assistant", content: botResponse },
      ]);
    } catch (error) {
      let errorMessage = t("chatbot.genericError");
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = t("chatbot.sessionExpired");
        } else if (
          [402, 429].includes(error.response.status) &&
          error.response.data?.flag === "feature.ai.tutor"
        ) {
          blockAiTutor(
            error.response.data?.error || t("chatbot.aiTutorDailyLimit")
          );
          return;
        } else if (error.response.status === 429) {
          errorMessage = t("chatbot.rateLimit");
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      }
      setMessages((prev) => [...prev, { sender: "bot", text: errorMessage }]);
    } finally {
      setIsLoading(false);
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
      }
    }
  };

  const showQuickReplies = messages.length <= 1;

  return (
    <>
      {/* FAB toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen
            ? t("chatbot.closeAssistantAria")
            : t("chatbot.openAssistantAria")
        }
        className="fixed bottom-6 right-6 z-[1100] inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1d5330] text-white shadow-lg shadow-[#1d5330]/40 transition hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1d5330]/40 sm:bottom-8 sm:right-8"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M4 4l10 10M14 4L4 14"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[1100] flex max-h-[70vh] w-[min(90vw,400px)] flex-col overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/60 sm:bottom-28 sm:right-8"
          style={{ backgroundColor: "#0b0f14" }}
        >
          {/* Header */}
          <header
            className="flex items-center justify-between px-5 py-3.5 border-b border-white/10"
            style={{ backgroundColor: "#0e1621" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d5330] text-xs font-bold text-white">
                G
              </div>
              <span className="text-sm font-semibold text-white/90">
                {t("chatbot.title")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white/70 focus:outline-none"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          {/* Messages */}
          <div
            ref={messagesEndRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ backgroundColor: "#0b0f14" }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "user" ? "justify-end" : msg.sender === "system" ? "justify-center" : "justify-start"}`}
              >
                {msg.sender === "user" ? (
                  <div
                    className="max-w-[82%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm text-white"
                    style={{ backgroundColor: "#1d5330" }}
                  >
                    {msg.text}
                  </div>
                ) : msg.sender === "system" ? (
                  <span className="text-xs text-white/30">{msg.text}</span>
                ) : (
                  <div className="flex max-w-[88%] items-start gap-2">
                    <BotAvatar />
                    <div
                      className="rounded-2xl rounded-bl-sm border border-white/10 px-3.5 py-2.5 text-sm space-y-2"
                      style={{ backgroundColor: "#111827", color: "#e5e7eb" }}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                      {msg.link && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
                          style={{
                            backgroundColor: "rgba(29,83,48,0.25)",
                            color: "#2a7347",
                            border: "1px solid rgba(42,115,71,0.4)",
                          }}
                          onClick={() => handleCourseClick(msg.link.path)}
                        >
                          <GarzoniIcon name="book" size={11} />
                          {msg.link.text}
                        </button>
                      )}
                      {msg.links && msg.links.length > 0 && (
                        <div className="space-y-1.5">
                          <p
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: "rgba(229,231,235,0.45)" }}
                          >
                            {t("chatbot.availablePaths")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.links.map((link, li) => (
                              <button
                                key={li}
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
                                style={{
                                  backgroundColor: "rgba(29,83,48,0.25)",
                                  color: "#2a7347",
                                  border: "1px solid rgba(42,115,71,0.4)",
                                }}
                                onClick={() => handleCourseClick(link.path)}
                              >
                                <GarzoniIcon name="book" size={11} />
                                {link.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <BotAvatar />
                <div
                  className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/10 px-3.5 py-3"
                  style={{ backgroundColor: "#111827" }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full"
                      style={{
                        backgroundColor: "rgba(229,231,235,0.5)",
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick replies */}
            {showQuickReplies && (
              <div className="flex items-start gap-2 pt-1">
                <BotAvatar />
                <div
                  className="rounded-2xl rounded-bl-sm border border-white/10 px-3.5 py-2.5 space-y-2.5"
                  style={{ backgroundColor: "#111827" }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(229,231,235,0.45)" }}
                  >
                    {t("chatbot.tryAsking")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        type="button"
                        className="rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
                        style={{
                          backgroundColor: "rgba(29,83,48,0.18)",
                          color: "#2a7347",
                          border: "1px solid rgba(42,115,71,0.45)",
                        }}
                        onClick={() => handleMessageSend(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div
            className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
            style={{ backgroundColor: "#0e1621" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleMessageSend()
              }
              placeholder={t("chatbot.inputPlaceholder")}
              className="h-9 flex-1 min-w-0 rounded-full border border-white/10 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#2a7347]/60"
              style={{ backgroundColor: "#111827", color: "#e5e7eb" }}
              aria-label={t("chatbot.chatInputAria")}
            />
            <button
              type="button"
              onClick={() => handleMessageSend()}
              disabled={!inputMessage.trim() || isLoading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d5330] text-white shadow-md transition hover:bg-[#2a7347] focus:outline-none focus:ring-2 focus:ring-[#1d5330]/40 disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
