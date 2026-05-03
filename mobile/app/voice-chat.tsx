/**
 * Voice Tutor — Pro-only screen.
 * Hold to record → Whisper transcription → GPT answer → TTS playback.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { fetchEntitlements, queryKeys, staleTimes } from "@garzoni/core";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import type { ThemeColors } from "../src/theme/palettes";

type Message = {
  role: "user" | "assistant";
  text: string;
};

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1, padding: spacing.lg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontSize: typography.lg, fontWeight: "700", color: c.text },
    closeBtn: { padding: spacing.sm },
    closeBtnText: { fontSize: typography.md, color: c.textMuted },
    bubble: {
      maxWidth: "80%",
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: c.accent + "30",
    },
    aiBubble: {
      alignSelf: "flex-start",
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    bubbleText: { fontSize: typography.base, color: c.text, lineHeight: 22 },
    roleLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 4,
      color: c.textMuted,
      textTransform: "uppercase",
    },
    recordArea: {
      paddingVertical: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
    },
    recordBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    recordBtnIdle: { backgroundColor: c.accent },
    recordBtnActive: { backgroundColor: c.error },
    recordBtnText: {
      fontSize: 28,
      color: "#fff",
    },
    statusText: { fontSize: typography.sm, color: c.textMuted },
    proGate: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    proGateTitle: {
      fontSize: typography.lg,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
    },
    proGateBody: {
      fontSize: typography.base,
      color: c.textMuted,
      textAlign: "center",
    },
    upgradeBtn: {
      backgroundColor: c.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    upgradeBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: typography.base,
    },
  });
}

export default function VoiceChat() {
  const c = useThemeColors();
  const styles = createStyles(c);
  const { t } = useTranslation("common");

  const { data: entitlementsRaw } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const entitlements = entitlementsRaw;
  const voiceEntitlement = entitlements?.features?.ai_voice;
  const isProUser = voiceEntitlement?.enabled === true;

  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "processing">(
    "idle",
  );
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission required",
          "Microphone access is needed for the voice tutor.",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setStatus("recording");
    } catch (e) {
      console.error("startRecording error", e);
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!recording) return;
    setStatus("processing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error("No recording URI");

      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);

      const res = await apiClient.post("/voice-tutor/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { transcript, response_text, audio_base64, mime } = res.data;

      setMessages((prev) => [
        ...prev,
        { role: "user", text: transcript },
        { role: "assistant", text: response_text },
      ]);

      // Play TTS audio
      if (audio_base64) {
        const dataUri = `data:${mime || "audio/mpeg"};base64,${audio_base64}`;
        const { sound: snd } = await Audio.Sound.createAsync({ uri: dataUri });
        setSound(snd);
        await snd.playAsync();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Could not process voice.";
      Alert.alert("Error", msg);
    } finally {
      setStatus("idle");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!isProUser) {
    return (
      <View style={styles.proGate}>
        <Text style={styles.proGateTitle}>Voice Tutor is Pro-only</Text>
        <Text style={styles.proGateBody}>
          Upgrade to Pro to speak directly with Garzoni and get instant spoken
          answers.
        </Text>
        <Pressable
          style={styles.upgradeBtn}
          onPress={() => router.push("/subscriptions")}
        >
          <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Tutor</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length === 0 && (
          <Text
            style={[
              styles.statusText,
              { textAlign: "center", marginTop: spacing.xl },
            ]}
          >
            Hold the button to ask Garzoni anything about finance.
          </Text>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={styles.roleLabel}>
              {m.role === "user" ? "You" : "Garzoni"}
            </Text>
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.recordArea}>
        <Text style={styles.statusText}>
          {status === "idle"
            ? "Hold to speak"
            : status === "recording"
              ? "Recording… release to send"
              : "Processing…"}
        </Text>
        <Pressable
          style={[
            styles.recordBtn,
            status === "recording"
              ? styles.recordBtnActive
              : styles.recordBtnIdle,
          ]}
          onPressIn={startRecording}
          onPressOut={stopRecordingAndProcess}
          disabled={status === "processing"}
        >
          <Text style={styles.recordBtnText}>
            {status === "recording"
              ? "⏹"
              : status === "processing"
                ? "⏳"
                : "🎙"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
