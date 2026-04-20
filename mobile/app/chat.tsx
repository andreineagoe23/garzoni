import { useCallback, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isAxiosError } from "axios";
import { Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cryptoDisplayName,
  fetchCryptoQuote,
  fetchEntitlements,
  fetchForexQuote,
  fetchStockQuote,
  normalizeCurrencyCode,
  queryKeys,
  requestAiTutorPayload,
  resolveCryptoId,
  staleTimes,
} from "@garzoni/core";
import type { AiTutorLink, Entitlements } from "@garzoni/core";
import { useAuthSession } from "../src/auth/AuthContext";
import GlassButton from "../src/components/ui/GlassButton";
import TypingBubble from "../src/components/ui/TypingBubble";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

type Msg = {
  role: "user" | "assistant" | "system";
  content: string;
  link?: AiTutorLink | null;
  links?: AiTutorLink[] | null;
};

type HistoryMsg = { role: "user" | "assistant"; content: string };

const FOREX_PAIR_RE = /(\b[a-zA-Z]{3})\b\s*(\/|to|and)\s*(\b[a-zA-Z]{3})\b/i;
const FOREX_RE =
  /what(?:'|')?s the exchange rate (?:from|of|between) ([a-zA-Z]{3}) (?:to|and) ([a-zA-Z]{3})(\?)?|forex (?:between|for) ([a-zA-Z]{3}) (?:and|to) ([a-zA-Z]{3})/i;
const CRYPTO_RE =
  /what(?:'|')?s the (?:price|value) of ([a-zA-Z\s]+)(\?)?|([a-zA-Z\s]+) (?:price|value)(\?)?/i;
const STOCK_RE =
  /what(?:'|')?s the (?:stock )?price of ([a-zA-Z]{1,5}) stock(\?)?|([a-zA-Z]{1,5}) stock price/i;

function fmtNumber(value: number, opts: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(undefined, opts).format(value);
  } catch {
    return value.toFixed(opts.maximumFractionDigits ?? 2);
  }
}

function fmtUsd(value: number, digits = 2): string {
  return fmtNumber(value, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMarketCap(marketCap: number): string | null {
  if (!marketCap) return null;
  if (marketCap >= 1e9) return `${fmtUsd(marketCap / 1e9)}B`;
  if (marketCap >= 1e6) return `${fmtUsd(marketCap / 1e6)}M`;
  return fmtUsd(marketCap, 0);
}

export default function ChatScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const queryClient = useQueryClient();

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
    enabled: isAuthenticated,
  });
  const aiTutorFeature = (entitlementsQuery.data as Entitlements | undefined)
    ?.features?.ai_tutor;

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("chatbot.greeting") },
  ]);
  const [history, setHistory] = useState<HistoryMsg[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const quickReplies = useMemo(
    () => [
      t("chatbot.quickReplies.compoundInterest"),
      t("chatbot.quickReplies.learningPaths"),
      t("chatbot.quickReplies.recommendCourse"),
      t("chatbot.quickReplies.bitcoinPrice"),
      t("chatbot.quickReplies.startInvesting"),
    ],
    [t],
  );

  const appendAssistant = useCallback((content: string, extra?: Partial<Msg>) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content, ...(extra ?? {}) },
    ]);
  }, []);

  const openCourseLink = useCallback((link: AiTutorLink) => {
    const path = link.path || "";
    if (!path) return;
    try {
      router.push(path as Parameters<typeof router.push>[0]);
    } catch {
      /* noop */
    }
  }, []);

  const resolveMarketReply = useCallback(
    async (text: string): Promise<string | null> => {
      const stockMatch = text.match(STOCK_RE);
      const forexPairMatch = text.match(FOREX_PAIR_RE);
      const forexMatch = text.match(FOREX_RE);
      const cryptoMatch = text.match(CRYPTO_RE);

      if (stockMatch) {
        const symbol = (stockMatch[1] || stockMatch[3]).toUpperCase();
        const stock = await fetchStockQuote(symbol);
        if (stock.price > 0) {
          return t("chatbot.responses.stockPrice", {
            symbol,
            price: fmtUsd(stock.price),
            direction:
              stock.change >= 0
                ? t("chatbot.responses.increased")
                : t("chatbot.responses.decreased"),
            change: fmtNumber(Math.abs(stock.change), {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          });
        }
        return t("chatbot.responses.stockNotFound", { symbol });
      }

      if (forexPairMatch || forexMatch) {
        let from: string;
        let to: string;
        if (forexPairMatch) {
          from = forexPairMatch[1];
          to = forexPairMatch[3];
        } else {
          from = forexMatch![1] || forexMatch![4];
          to = forexMatch![2] || forexMatch![5];
        }
        from = normalizeCurrencyCode(from);
        to = normalizeCurrencyCode(to);
        const fx = await fetchForexQuote(from, to);
        if (fx.rate > 0) {
          let msg = t("chatbot.responses.forexRate", {
            from,
            to,
            rate: fmtNumber(fx.rate, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            }),
          });
          if (Math.abs(fx.change) > 0.0001) {
            msg += ` ${t("chatbot.responses.forexChanged", {
              sign: fx.change >= 0 ? "+" : "",
              change: fmtNumber(fx.change, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              }),
            })}`;
          }
          return msg;
        }
        return t("chatbot.responses.forexNotFound", { from, to });
      }

      if (cryptoMatch) {
        const rawName = (cryptoMatch[1] || cryptoMatch[3]) ?? "";
        const cryptoId = resolveCryptoId(rawName);
        if (!cryptoId) return t("chatbot.responses.cryptoUnrecognized");
        const crypto = await fetchCryptoQuote(cryptoId);
        const name = cryptoDisplayName(cryptoId);
        if (crypto.price > 0) {
          let msg = t("chatbot.responses.cryptoPrice", {
            name,
            price: fmtUsd(crypto.price),
            direction:
              crypto.change >= 0
                ? t("chatbot.responses.up")
                : t("chatbot.responses.down"),
            change: fmtNumber(Math.abs(crypto.change), {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          });
          const cap = formatMarketCap(crypto.marketCap);
          if (cap) {
            msg += ` ${t("chatbot.responses.marketCap", { marketCap: cap })}`;
          }
          return msg;
        }
        return t("chatbot.responses.cryptoNotFound", { name });
      }

      return null;
    },
    [t],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;

      if (!isAuthenticated) {
        appendAssistant(t("chatbot.loginRequired"));
        router.replace("/login");
        return;
      }

      const userMsg: Msg = { role: "user", content: text };
      const userHistory: HistoryMsg = { role: "user", content: text };
      const nextHistory = [...history, userHistory];
      setMessages((prev) => [...prev, userMsg]);
      setHistory(nextHistory);

      if (aiTutorFeature) {
        if (!aiTutorFeature.enabled) {
          appendAssistant(t("chatbot.aiTutorPremiumOnly"));
          router.push("/subscriptions");
          return;
        }
        if (aiTutorFeature.remaining_today === 0) {
          appendAssistant(t("chatbot.aiTutorDailyLimit"));
          router.push("/subscriptions");
          return;
        }
      }

      setBusy(true);
      try {
        const marketReply = await resolveMarketReply(text);
        if (marketReply) {
          appendAssistant(marketReply);
          setHistory([
            ...nextHistory,
            { role: "assistant", content: marketReply },
          ]);
          return;
        }

        const payload = await requestAiTutorPayload(text, {
          chatHistory: nextHistory.slice(-10),
          temperature: 0.7,
        });
        const reply = payload.text?.trim()
          ? payload.text
          : t("chatbot.genericError");
        appendAssistant(reply, {
          link: payload.link ?? null,
          links: payload.links ?? null,
        });
        setHistory([...nextHistory, { role: "assistant", content: reply }]);
      } catch (err: unknown) {
        let errorMessage = t("chatbot.genericError");
        if (isAxiosError(err)) {
          const status = err.response?.status;
          const data = err.response?.data as
            | { flag?: string; error?: string }
            | undefined;
          if (status === 401) {
            errorMessage = t("chatbot.sessionExpired");
          } else if (
            (status === 402 || status === 429) &&
            data?.flag === "feature.ai.tutor"
          ) {
            errorMessage = data?.error || t("chatbot.aiTutorDailyLimit");
            appendAssistant(errorMessage);
            router.push("/subscriptions");
            return;
          } else if (status === 429) {
            errorMessage = t("chatbot.rateLimit");
          } else if (data?.error) {
            errorMessage = data.error;
          }
        }
        appendAssistant(errorMessage);
      } finally {
        setBusy(false);
        if (isAuthenticated) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.entitlements(),
          });
        }
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      }
    },
    [
      aiTutorFeature,
      appendAssistant,
      busy,
      history,
      isAuthenticated,
      queryClient,
      resolveMarketReply,
      t,
    ],
  );

  const onSendPress = useCallback(() => {
    const text = input;
    setInput("");
    void sendMessage(text);
  }, [input, sendMessage]);

  const onQuickReply = useCallback(
    (reply: string) => {
      void sendMessage(reply);
    },
    [sendMessage],
  );

  const showQuickReplies = messages.length <= 1 && !busy;

  return (
    <>
      <Stack.Screen
        options={{
          title: t("chatbot.title"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: c.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isSystem = m.role === "system";
            return (
              <View
                key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                style={[
                  styles.bubble,
                  isUser
                    ? { alignSelf: "flex-end", backgroundColor: c.primary }
                    : isSystem
                      ? {
                          alignSelf: "center",
                          backgroundColor: c.surfaceElevated,
                          borderColor: c.border,
                          borderWidth: StyleSheet.hairlineWidth,
                        }
                      : {
                          alignSelf: "flex-start",
                          backgroundColor: c.surfaceElevated,
                          borderColor: c.border,
                          borderWidth: StyleSheet.hairlineWidth,
                        },
                ]}
              >
                <Text
                  style={{
                    color: isUser ? c.white : c.text,
                    fontSize: typography.sm,
                    lineHeight: 20,
                  }}
                >
                  {m.content}
                </Text>
                {m.link ? (
                  <Pressable
                    onPress={() => openCourseLink(m.link!)}
                    style={[
                      styles.linkChip,
                      { backgroundColor: c.accentMuted, borderColor: c.border },
                    ]}
                  >
                    <Text
                      style={[styles.linkChipText, { color: c.primary }]}
                      numberOfLines={1}
                    >
                      {m.link.text}
                    </Text>
                  </Pressable>
                ) : null}
                {m.links && m.links.length > 0 ? (
                  <View style={styles.linksBlock}>
                    <Text
                      style={[styles.linksHeading, { color: c.textMuted }]}
                    >
                      {t("chatbot.availablePaths")}
                    </Text>
                    <View style={styles.linksRow}>
                      {m.links.map((link, j) => (
                        <Pressable
                          key={`${j}-${link.path}`}
                          onPress={() => openCourseLink(link)}
                          style={[
                            styles.linkChip,
                            {
                              backgroundColor: c.accentMuted,
                              borderColor: c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.linkChipText, { color: c.primary }]}
                            numberOfLines={1}
                          >
                            {link.text}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
          {busy ? <TypingBubble label={t("chatbot.typing")} /> : null}
          {showQuickReplies ? (
            <View style={styles.quickBlock}>
              <Text style={[styles.quickHeading, { color: c.textMuted }]}>
                {t("chatbot.tryAsking")}
              </Text>
              <View style={styles.quickRow}>
                {quickReplies.map((reply) => (
                  <Pressable
                    key={reply}
                    onPress={() => onQuickReply(reply)}
                    style={[
                      styles.quickChip,
                      { borderColor: c.border, backgroundColor: c.surface },
                    ]}
                  >
                    <Text
                      style={[styles.quickChipText, { color: c.primary }]}
                      numberOfLines={2}
                    >
                      {reply}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View
          style={[
            styles.inputRow,
            { borderTopColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("chatbot.inputPlaceholder")}
            placeholderTextColor={c.textFaint}
            style={[
              styles.input,
              {
                borderColor: c.border,
                color: c.text,
                backgroundColor: c.inputBg,
              },
            ]}
            multiline
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (input.trim()) onSendPress();
            }}
          />
          <GlassButton
            variant="active"
            size="md"
            onPress={onSendPress}
            loading={busy}
            disabled={!input.trim()}
          >
            {t("chatbot.send")}
          </GlassButton>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  bubble: {
    maxWidth: "88%",
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  linkChip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkChipText: { fontSize: typography.xs, fontWeight: "700" },
  linksBlock: { gap: spacing.xs },
  linksHeading: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  linksRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  quickBlock: { gap: spacing.sm, marginTop: spacing.sm },
  quickHeading: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },
  quickChipText: { fontSize: typography.sm, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
  },
});
