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
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  fetchEntitlements,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { brand } from "../../../src/theme/brand";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";
import { useScreenGutter } from "../../../src/utils/platform";
import { trackGarzoniEvent } from "../../../src/bootstrap/customerIoMobile";
import { href } from "../../../src/navigation/href";
import { logDevError } from "../../../src/lib/logDevError";

// Always-dark design constants — matches mobile/app/chat.tsx (Finance Assistant)
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

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPT_KEYS = [
  "ontrack",
  "invest_more",
  "diversify",
  "cut_spending",
] as const;

const QUICK_PROMPT_FALLBACKS: Record<
  (typeof QUICK_PROMPT_KEYS)[number],
  string
> = {
  ontrack: "Am I on track for my financial goals?",
  invest_more: "What if I invest $200 more per month?",
  diversify: "How diversified is my portfolio?",
  cut_spending: "Where should I cut my spending?",
};

const QUICK_PROMPT_EMOJI: Record<(typeof QUICK_PROMPT_KEYS)[number], string> = {
  ontrack: "🎯",
  invest_more: "📈",
  diversify: "📊",
  cut_spending: "✂️",
};

function BotAvatar() {
  return (
    <View style={styles.botAvatar}>
      <Text style={styles.botAvatarText}>G</Text>
    </View>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <View style={styles.rowUser}>
        <View style={styles.bubbleUser}>
          <Text style={styles.bubbleUserText}>{msg.content}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.rowBot}>
      <BotAvatar />
      <View style={styles.bubbleBot}>
        <Text style={styles.bubbleBotText}>{msg.content}</Text>
      </View>
    </View>
  );
}

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

export default function PersonalCfoCoachScreen() {
  const colors = useThemeColors();
  const gutter = useScreenGutter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");
  const router = useRouter();

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const hasPlus = ["plus", "pro"].includes(entQuery.data?.plan ?? "");

  useEffect(() => {
    if (entQuery.isFetched && !hasPlus) {
      router.replace(href("/(tabs)/tools"));
    }
  }, [entQuery.isFetched, hasPlus, router]);

  useEffect(() => {
    void trackGarzoniEvent("personal_cfo_coach_open", { surface: "mobile" });
  }, []);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("tools.cfoCoach.greeting") },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  const quickReplies = useMemo(
    () =>
      QUICK_PROMPT_KEYS.map((key) => ({
        key,
        emoji: QUICK_PROMPT_EMOJI[key],
        text: t(`tools.cfoCoach.prompts.${key}`, QUICK_PROMPT_FALLBACKS[key]),
      })),
    [t],
  );

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setBusy(true);
      try {
        const res = await (apiClient as any).post("/personal-cfo/coach/", {
          message: text,
          surface: "mobile",
        });
        const reply =
          (res.data?.response as string | undefined) ||
          (res.data?.text as string | undefined) ||
          t("tools.cfoCoach.errors.empty");
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        void trackGarzoniEvent("personal_cfo_coach_message", {
          surface: "mobile",
        });
      } catch (err: any) {
        logDevError("tools/personal-cfo-coach", err);
        const status = err?.response?.status;
        let msg = t("tools.cfoCoach.errors.generic");
        if (status === 402) {
          msg = t("tools.cfoCoach.errors.upgrade");
        } else if (status === 429) {
          msg = t("tools.cfoCoach.errors.rateLimit");
        } else if (err?.response?.data?.error) {
          msg = String(err.response.data.error);
        }
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      } finally {
        setBusy(false);
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: true }),
          80,
        );
      }
    },
    [busy, t],
  );

  const onSendPress = useCallback(() => {
    const text = input;
    setInput("");
    void send(text);
  }, [input, send]);

  const showQuickReplies = messages.length <= 1 && !busy;

  // Account for modal header chrome (~44 on iOS) so composer clears keyboard.
  const keyboardOffset =
    Platform.OS === "ios" ? Math.max(44, insets.top + 44) : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: D.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={styles.customHeader}>
        <View style={styles.grabber} />
        <Text style={styles.customHeaderTitle}>
          {t("tools.cfoCoach.title")}
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: spacing.md + gutter },
        ]}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
            msg={m}
          />
        ))}
        {busy ? <TypingBubble /> : null}
        {showQuickReplies ? (
          <View style={styles.quickBlock}>
            <Text style={styles.quickHeading}>
              {t("tools.cfoCoach.tryAsking", "Try asking me about:")}
            </Text>
            <View style={styles.quickRow}>
              {quickReplies.map((q) => (
                <Pressable
                  key={q.key}
                  onPress={() => void send(q.text)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text style={styles.quickChipText} numberOfLines={2}>
                    {`${q.emoji}  ${q.text}`}
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
          placeholder={t("tools.cfoCoach.placeholder")}
          placeholderTextColor={D.faint}
          style={styles.input}
          multiline
          editable={!busy}
          returnKeyType="send"
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
          <View style={styles.sendBtnIconWrap}>
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 24 },

  customHeader: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs + 2,
    backgroundColor: D.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.border,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  customHeaderTitle: {
    color: D.text,
    fontSize: 17,
    fontWeight: "600",
  },

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

  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: D.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    marginTop: 2,
  },
  botAvatarText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: { lineHeight: 15 },
    }),
  },

  bubbleUser: {
    maxWidth: "82%",
    backgroundColor: D.userBg,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUserText: { color: "#fff", fontSize: typography.sm, lineHeight: 20 },
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
  bubbleBotText: { color: D.text, fontSize: typography.sm, lineHeight: 20 },

  typingDots: { flexDirection: "row", gap: 4, alignItems: "center" },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: D.muted,
  },

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
    color: brand.goldWarm,
  },

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
    overflow: "hidden",
  },
  sendBtnIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
