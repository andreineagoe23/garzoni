/**
 * Voice Tutor — Pro-only screen.
 * Hold to record → Whisper transcription → GPT answer → TTS playback.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type * as ExpoAudio from "expo-audio";
import { router } from "expo-router";
import {
  isAppActiveForAudio,
  isBackgroundAudioError,
} from "../src/lib/audioPlayback";
import { logDevError } from "../src/lib/logDevError";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  apiClient,
  fetchEntitlements,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useQuery } from "@tanstack/react-query";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { useScreenGutter } from "../src/utils/platform";
import type { ThemeColors } from "../src/theme/palettes";

type AudioApi = typeof ExpoAudio;
type AudioRecorder = InstanceType<AudioApi["AudioModule"]["AudioRecorder"]>;
type AudioPlayer = ReturnType<AudioApi["createAudioPlayer"]>;

let audioModule: AudioApi | null | undefined;

/**
 * Resolve expo-audio on first use rather than at module scope.
 *
 * expo-router imports every route file during startup, and expo-audio throws at
 * import time when its native module is missing (a dev build or an OTA-updated
 * binary built before it was added). Loading it lazily confines that failure to
 * this Pro-gated screen instead of taking down every cold start.
 */
function getAudio(): AudioApi | null {
  if (audioModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      audioModule = require("expo-audio") as AudioApi;
    } catch {
      /* native module not in this dev build — feature gated at runtime */
      audioModule = null;
    }
  }
  return audioModule ?? null;
}

/** What `useAudioRecorder` does to a preset before handing it to the native recorder. */
function createRecorder(Audio: AudioApi): AudioRecorder {
  const preset = Audio.RecordingPresets.HIGH_QUALITY;
  return new Audio.AudioModule.AudioRecorder({
    extension: preset.extension,
    sampleRate: preset.sampleRate,
    numberOfChannels: preset.numberOfChannels,
    bitRate: preset.bitRate,
    isMeteringEnabled: false,
    ...(Platform.OS === "ios" ? preset.ios : preset.android),
  });
}

/** expo-av's defaults: mix on iOS, duck others on Android. */
const INTERRUPTION_MODE =
  Platform.OS === "android" ? "duckOthers" : "mixWithOthers";

function releaseRecorder(rec: AudioRecorder) {
  try {
    rec.release();
  } catch {
    /* already released */
  }
}

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
  const gutter = useScreenGutter();
  const styles = createStyles(c);
  useTranslation("common");
  const insets = useSafeAreaInsets();

  const { data: entitlementsRaw } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const entitlements = entitlementsRaw;
  const voiceEntitlement = entitlements?.features?.ai_voice;
  const isProUser = voiceEntitlement?.enabled === true;

  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "processing">(
    "idle",
  );
  const scrollRef = useRef<ScrollView>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const pendingTtsUriRef = useRef<string | null>(null);

  const unloadSound = useCallback(async () => {
    const current = soundRef.current;
    soundRef.current = null;
    if (current) {
      try {
        current.remove();
      } catch {
        /* already released */
      }
    }
  }, []);

  const playTtsFromUri = useCallback(
    async (dataUri: string) => {
      const Audio = getAudio();
      if (!Audio) return;

      if (!isAppActiveForAudio()) {
        pendingTtsUriRef.current = dataUri;
        return;
      }

      try {
        await unloadSound();
        await Audio.setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: INTERRUPTION_MODE,
        });
        const player = Audio.createAudioPlayer({ uri: dataUri });
        soundRef.current = player;
        player.play();
      } catch (e) {
        if (isBackgroundAudioError(e)) {
          pendingTtsUriRef.current = dataUri;
          return;
        }
        logDevError("voice-chat.playTts", e);
      }
    },
    [unloadSound],
  );

  useEffect(() => {
    return () => {
      void unloadSound();
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (rec) {
        void rec
          .stop()
          .catch(() => undefined)
          .finally(() => releaseRecorder(rec));
      }
    };
  }, [unloadSound]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const pending = pendingTtsUriRef.current;
      if (!pending) return;
      pendingTtsUriRef.current = null;
      void playTtsFromUri(pending);
    });
    return () => sub.remove();
  }, [playTtsFromUri]);

  const startRecording = async () => {
    const Audio = getAudio();
    if (!Audio) {
      Alert.alert(
        "Not available",
        "Voice requires a development build with expo-audio.",
      );
      return;
    }
    if (!isAppActiveForAudio()) {
      return;
    }
    try {
      // Release any leftover recorder from a previous session
      const leftover = recorderRef.current;
      if (leftover) {
        recorderRef.current = null;
        try {
          await leftover.stop();
        } catch {
          // already stopped — safe to ignore
        }
        releaseRecorder(leftover);
      }

      const { granted } = await Audio.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission required",
          "Microphone access is needed for the voice tutor.",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: INTERRUPTION_MODE,
      });
      const rec = createRecorder(Audio);
      try {
        await rec.prepareToRecordAsync();
        rec.record();
      } catch (e) {
        releaseRecorder(rec);
        throw e;
      }
      recorderRef.current = rec;
      setStatus("recording");
    } catch (e) {
      if (!isBackgroundAudioError(e)) {
        logDevError("voice-chat.startRecording", e);
      }
    }
  };

  const stopRecordingAndProcess = async () => {
    const Audio = getAudio();
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setStatus("processing");
    try {
      await rec.stop();
      const uri = rec.uri;
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

      if (audio_base64 && Audio) {
        const dataUri = `data:${mime || "audio/mpeg"};base64,${audio_base64}`;
        await playTtsFromUri(dataUri);
      }
    } catch (e: any) {
      if (isBackgroundAudioError(e)) {
        return;
      }
      const msg = e?.response?.data?.error || "Could not process voice.";
      Alert.alert("Error", msg);
    } finally {
      releaseRecorder(rec);
      setStatus("idle");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!isProUser) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.title}>Voice Tutor</Text>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>Done</Text>
          </Pressable>
        </View>
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Voice Tutor</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: spacing.xl,
          paddingHorizontal: gutter,
        }}
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
          <MaterialCommunityIcons
            name={
              status === "recording"
                ? "stop"
                : status === "processing"
                  ? "timer-sand"
                  : "microphone"
            }
            size={32}
            color="#fff"
          />
        </Pressable>
      </View>
    </View>
  );
}
