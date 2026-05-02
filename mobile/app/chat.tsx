import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { Stack, router, useLocalSearchParams } from "expo-router";
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
import { brand } from "../src/theme/brand";
import { spacing, typography, radius } from "../src/theme/tokens";

// ── Always-dark design constants (matches subscriptions page) ────────────────
const D = {
  bg: brand.bgDark,
  surface: "#0e1621",
  card: "#111827",
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.07)",
  primary: brand.green,
  primaryDim: "rgba(29,83,48,0.18)",
  primaryBright: "#2a7347",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.32)",
  userBg: brand.green,
  botBg: "#131e2b",
} as const;

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
  /what(?:'|')?s the (?:price|value) of ([a-zA-Z\s]+?)(?:\s+(?:today|now|right now|currently))?(\?)?$|([a-zA-Z\s]+?) (?:price|value)(?:\s+(?:today|now|right now|currently))?(\?)?/i;
const STOCK_RE =
  /what(?:'|')?s the (?:stock )?price of ([a-zA-Z]{1,5}) stock(\?)?|([a-zA-Z]{1,5}) stock price/i;
const TIME_RE =
  /\b(what(?:'s|'s)?\s+(?:the\s+)?(?:current\s+)?time|what\s+time\s+is\s+it|current\s+time|time\s+now)\b/i;
const DATE_RE =
  /\b(what(?:'s|'s)?\s+(?:the\s+)?(?:today'?s?\s+)?date|today'?s?\s+date|what\s+day\s+is\s+(?:it|today))\b/i;

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

// ── Bot avatar ────────────────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <View style={styles.botAvatar}>
      <Text style={styles.botAvatarText}>G</Text>
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onLinkPress,
}: {
  msg: Msg;
  onLinkPress: (link: AiTutorLink) => void;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isUser) {
    return (
      <View style={styles.rowUser}>
        <View style={styles.bubbleUser}>
          <Text style={styles.bubbleUserText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  if (isSystem) {
    return (
      <View style={styles.rowSystem}>
        <Text style={styles.systemText}>{msg.content}</Text>
      </View>
    );
  }

  return (
    <View style={styles.rowBot}>
      <BotAvatar />
      <View style={styles.bubbleBot}>
        <Text style={styles.bubbleBotText}>{msg.content}</Text>
        {msg.link ? (
          <Pressable
            onPress={() => onLinkPress(msg.link!)}
            style={styles.linkChip}
          >
            <MaterialCommunityIcons
              name="book-open-variant"
              size={12}
              color={D.primaryBright}
            />
            <Text style={styles.linkChipText} numberOfLines={1}>
              {msg.link.text}
            </Text>
          </Pressable>
        ) : null}
        {msg.links && msg.links.length > 0 ? (
          <View style={styles.linksBlock}>
            <Text style={styles.linksHeading}>Available paths</Text>
            <View style={styles.linksRow}>
              {msg.links.map((link, j) => (
                <Pressable
                  key={`${j}-${link.path}`}
                  onPress={() => onLinkPress(link)}
                  style={styles.linkChip}
                >
                  <MaterialCommunityIcons
                    name="book-open-variant"
                    size={12}
                    color={D.primaryBright}
                  />
                  <Text style={styles.linkChipText} numberOfLines={1}>
                    {link.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <View style={styles.rowBot}>
      <BotAvatar />
      <View style={[styles.bubbleBot, { paddingVertical: spacing.sm + 4 }]}>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.typingDot} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { t } = useTranslation("common");
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const { preseededMessage } = useLocalSearchParams<{
    preseededMessage?: string;
  }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

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

  const appendAssistant = useCallback(
    (content: string, extra?: Partial<Msg>) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content, ...(extra ?? {}) },
      ]);
    },
    [],
  );

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
      // Client-side time / date queries
      if (TIME_RE.test(text)) {
        const now = new Date();
        return `It's currently ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} on your device.`;
      }
      if (DATE_RE.test(text)) {
        return `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
      }

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
        const rawName = (cryptoMatch[1] || cryptoMatch[3] || "").trim();
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

        const isPreseed = nextHistory.length === 1 && Boolean(preseededMessage);
        const payload = await requestAiTutorPayload(text, {
          chatHistory: nextHistory.slice(-10),
          temperature: 0.7,
          source: isPreseed ? "exercise_hint" : "chat",
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
      preseededMessage,
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

  useEffect(() => {
    if (preseededMessage) {
      void sendMessage(decodeURIComponent(preseededMessage));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onQuickReply = useCallback(
    (reply: string) => {
      void sendMessage(reply);
    },
    [sendMessage],
  );

  const showQuickReplies = messages.length <= 1 && !busy;

  // KAV sits below the Stack header, so no top offset needed.
  // On Android use height mode to avoid double-shifting.
  const keyboardOffset = 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: t("chatbot.title"),
          headerShown: true,
          headerStyle: { backgroundColor: D.surface },
          headerTintColor: D.primaryBright,
          headerShadowVisible: false,
          headerBackTitle: "",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/voice-chat" as any)}
              style={{ marginRight: 12, padding: 4 }}
              accessibilityLabel="Voice tutor"
            >
              <MaterialCommunityIcons name="microphone" size={22} color={D.primaryBright} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: D.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m, i) => (
            <MessageBubble
              key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
              msg={m}
              onLinkPress={openCourseLink}
            />
          ))}
          {busy ? <TypingBubble /> : null}
          {showQuickReplies ? (
            <View style={styles.quickBlock}>
              <Text style={styles.quickHeading}>{t("chatbot.tryAsking")}</Text>
              <View style={styles.quickRow}>
                {quickReplies.map((reply) => (
                  <Pressable
                    key={reply}
                    onPress={() => onQuickReply(reply)}
                    style={({ pressed }) => [
                      styles.quickChip,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.quickChipText} numberOfLines={2}>
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
            { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("chatbot.inputPlaceholder")}
            placeholderTextColor={D.faint}
            style={styles.input}
            multiline
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (input.trim()) onSendPress();
            }}
          />
          <Pressable
            onPress={onSendPress}
            disabled={!input.trim() || busy}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                opacity: !input.trim() || busy ? 0.4 : pressed ? 0.8 : 1,
                backgroundColor: D.primary,
              },
            ]}
          >
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 24,
  },

  // Message rows
  rowUser: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.xs,
  },
  rowBot: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowSystem: {
    alignItems: "center",
    marginVertical: spacing.sm,
  },

  // Bot avatar
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: D.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  botAvatarText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Bubbles
  bubbleUser: {
    maxWidth: "82%",
    backgroundColor: D.userBg,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUserText: {
    color: "#fff",
    fontSize: typography.sm,
    lineHeight: 20,
  },
  bubbleBot: {
    flex: 1,
    maxWidth: "82%",
    backgroundColor: D.botBg,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: D.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  bubbleBotText: {
    color: D.text,
    fontSize: typography.sm,
    lineHeight: 20,
  },
  systemText: {
    color: D.muted,
    fontSize: typography.xs,
    textAlign: "center",
  },

  // Course links
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xl,
    backgroundColor: "rgba(29,83,48,0.2)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(42,115,71,0.4)",
  },
  linkChipText: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: "#4ade80",
  },
  linksBlock: { gap: spacing.xs },
  linksHeading: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    color: D.muted,
    letterSpacing: 0.6,
  },
  linksRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

  // Typing
  typingDots: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: D.muted,
  },

  // Quick replies
  quickBlock: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  quickHeading: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    color: D.muted,
    letterSpacing: 0.8,
    marginLeft: spacing.xs,
  },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(29,83,48,0.55)",
    backgroundColor: "rgba(29,83,48,0.12)",
    maxWidth: "100%",
  },
  quickChipText: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: "#4ade80",
  },

  // Input bar
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: D.border,
    backgroundColor: D.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: D.border,
    backgroundColor: D.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    color: D.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
