import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { requestAiTutorResponse } from "@garzoni/core";
import GlassButton from "../src/components/ui/GlassButton";
import TypingBubble from "../src/components/ui/TypingBubble";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: t("chat.greeting"),
    },
  ]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextUser: Msg = { role: "user", content: text };
    setInput("");
    setMessages((m) => [...m, nextUser]);
    setBusy(true);
    try {
      const history = [...messages, nextUser].map(({ role, content }) => ({
        role,
        content,
      }));
      const reply = await requestAiTutorResponse(text, {
        chatHistory: history,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply?.trim() ? reply : t("chat.errorReply"),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: t("chat.errorReply"),
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, busy, messages, t]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("chat.screenTitle"),
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
          {messages.map((m, i) => (
            <View
              key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
              style={[
                styles.bubble,
                m.role === "user"
                  ? { alignSelf: "flex-end", backgroundColor: c.primary }
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
                  color: m.role === "user" ? c.white : c.text,
                  fontSize: typography.sm,
                  lineHeight: 20,
                }}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {busy ? <TypingBubble label={t("chat.typing")} /> : null}
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
            placeholder={t("chat.placeholder")}
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
          />
          <GlassButton
            variant="active"
            size="md"
            onPress={() => void send()}
            loading={busy}
            disabled={!input.trim()}
          >
            {t("chat.send")}
          </GlassButton>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  bubble: { maxWidth: "88%", padding: spacing.md, borderRadius: radius.lg },
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
