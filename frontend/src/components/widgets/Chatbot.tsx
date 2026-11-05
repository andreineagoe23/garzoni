import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import UpsellModal from "components/billing/UpsellModal";
import { fetchEntitlements } from "services/entitlementsService";
import apiClient from "services/httpClient";
import { queryKeys, staleTimes } from "lib/reactQuery";
import { GarzoniIcon } from "components/ui/garzoniIcons";

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
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

  // Load persisted conversation history from server when chat first opens
  useEffect(() => {
    if (!isOpen || historyLoaded || !isAuthenticated) return;
    setHistoryLoaded(true);
    apiClient
      .get("/conversation/history/", { params: { source: "chat", limit: 50 } })
      .then((res) => {
        const serverMessages = (res.data?.messages || []).map((m) => ({
          sender: m.role === "user" ? "user" : "bot",
          text: m.content,
        }));
        if (serverMessages.length > 0) {
          setMessages(serverMessages);
          setHasGreeted(true);
        } else if (!hasGreeted) {
          setMessages([{ sender: "bot", text: t("chatbot.greeting") }]);
          setHasGreeted(true);
        }
      })
      .catch(() => {
        if (!hasGreeted) {
          setMessages([{ sender: "bot", text: t("chatbot.greeting") }]);
          setHasGreeted(true);
        }
      });
  }, [isOpen, historyLoaded, isAuthenticated, hasGreeted, t]);

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
      const token = getAccessToken();
      if (!token) throw new Error(t("chatbot.authTokenMissing"));
      const response = await apiClient.post("/proxy/openai/", {
        inputs: userMessage,
        source: "chat",
        parameters: { temperature: 0.7 },
      });
      const botResponse = response.data.response;
      const responseLink = response.data.link ?? null;
      const responseLinks = Array.isArray(response.data.links)
        ? response.data.links
        : null;

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: botResponse,
          link: responseLink,
          links: responseLinks,
        },
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
