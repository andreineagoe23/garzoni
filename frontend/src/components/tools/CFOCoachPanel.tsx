import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import { recordFunnelEvent } from "services/analyticsService";

type Message = {
  role: "user" | "assistant";
  content: string;
  id: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const QUICK_PROMPTS: { key: string; text: string }[] = [
  { key: "ontrack", text: "Am I on track for my financial goals?" },
  { key: "invest_more", text: "What if I invest $200 more per month?" },
  { key: "diversify", text: "How diversified is my portfolio?" },
  { key: "cut_spending", text: "Where should I cut my spending?" },
];

const CFOCoachPanel = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const greeting = useMemo(() => t("tools.cfoCoach.greeting"), [t]);

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || sending) return;
      setError(null);
      const userMsg: Message = {
        role: "user",
        content: trimmed,
        id: `u-${Date.now()}`,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);
      try {
        const res = await apiClient.post("/personal-cfo/coach/", {
          message: trimmed,
        });
        const assistantText: string =
          res.data?.response || res.data?.text || "";
        const reply: Message = {
          role: "assistant",
          content: assistantText || t("tools.cfoCoach.errors.empty"),
          id: `a-${Date.now()}`,
        };
        setMessages((prev) => [...prev, reply]);
        recordFunnelEvent("personal_cfo_coach_message", {
          metadata: { surface: "web" },
        }).catch(() => undefined);
      } catch (err) {
        const e = err as {
          response?: { status?: number; data?: { error?: string } };
        };
        if (e?.response?.status === 402) {
          setError(t("tools.cfoCoach.errors.upgrade"));
        } else if (e?.response?.status === 429) {
          setError(t("tools.cfoCoach.errors.rateLimit"));
        } else {
          setError(
            e?.response?.data?.error || t("tools.cfoCoach.errors.generic")
          );
        }
      } finally {
        setSending(false);
      }
    },
    [sending, t]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end"
    >
      <button
        type="button"
        aria-label={t("common.close") || "Close"}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full max-w-xl flex-col bg-[color:var(--card-bg)] shadow-2xl sm:m-6 sm:rounded-2xl"
        style={{ maxHeight: "min(90vh, 720px)", height: "90vh" }}
      >
        <header className="flex items-center justify-between border-b border-[color:var(--border-color)] px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.cfoCoach.eyebrow")}
            </p>
            <h3 className="text-base font-semibold text-content-primary">
              {t("tools.cfoCoach.title")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border-color)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted"
          >
            {t("common.close")}
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-3 text-sm text-content-primary">
              {greeting}
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  m.role === "user"
                    ? "bg-[color:var(--primary)] text-white"
                    : "bg-[color:var(--input-bg,#f9fafb)] text-content-primary"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[color:var(--input-bg,#f9fafb)] px-4 py-2.5 text-sm text-content-muted">
                {t("tools.cfoCoach.thinking")}
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="border-t border-[color:var(--border-color)] px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.cfoCoach.quickPrompts")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() =>
                    void send(t(`tools.cfoCoach.prompts.${q.key}`, q.text))
                  }
                  className="rounded-full border border-[color:var(--border-color)] px-3 py-1 text-xs text-content-primary transition hover:bg-[color:var(--input-bg,#f9fafb)]"
                >
                  {t(`tools.cfoCoach.prompts.${q.key}`, q.text)}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="flex items-center gap-2 border-t border-[color:var(--border-color)] px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("tools.cfoCoach.placeholder")}
            className="flex-1 rounded-full border border-[color:var(--border-color)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {t("tools.cfoCoach.send")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CFOCoachPanel;
