import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { brand } from "../../theme/brand";
import LoadingSpinner from "../ui/LoadingSpinner";
import { registerForPushAndSubmitToken } from "../../bootstrap/pushNotificationsMobile";
import { trackEvent } from "../../lib/analytics";

const APP_ICON = require("../../../assets/garzoni-logo-square-no-bg.png");

const C = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
};

// ── Ambient glow ─────────────────────────────────────────────────────────────
function Glow({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="ppg" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="65%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height / 2}
        rx={width / 2}
        ry={height / 2}
        fill="url(#ppg)"
      />
    </Svg>
  );
}

type Props = {
  /**
   * Called after the user answers either way (accept path waits for the OS
   * permission flow inside registerForPushAndSubmitToken to settle first).
   */
  onComplete: () => void;
};

/**
 * Custom push pre-permission screen (2.3): previews the actual notification a
 * user would get (mock iOS-style banner) before the OS prompt fires, so the
 * one-shot system dialog is only spent on primed users.
 */
export default function PushPromptScreen({ onComplete }: Props) {
  const { t } = useTranslation("common");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    trackEvent("push_prompt_shown", { source: "onboarding" });
  }, []);

  // Gentle float on the mock notification card — draws the eye to the value.
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatY]);

  const handleAccept = async () => {
    if (requesting) return;
    setRequesting(true);
    trackEvent("push_prompt_accepted", { source: "onboarding" });
    try {
      // OS permission prompt fires inside; never block onboarding on failure.
      await registerForPushAndSubmitToken();
    } catch {
      // Ignore — user continues to the paywall regardless.
    } finally {
      setRequesting(false);
      onComplete();
    }
  };

  const handleDecline = () => {
    if (requesting) return;
    trackEvent("push_prompt_declined", { source: "onboarding" });
    onComplete();
  };

  return (
    <View style={s.screen}>
      <View style={s.ambientTop} pointerEvents="none">
        <Glow width={420} height={300} color={C.primary} opacity={0.2} />
      </View>
      <View style={s.ambientBottom} pointerEvents="none">
        <Glow width={340} height={240} color={C.goldWarm} opacity={0.06} />
      </View>

      <View style={s.content}>
        <Text style={s.eyebrow}>{t("onboarding.pushPrompt.eyebrow")}</Text>
        <Text style={s.headline}>{t("onboarding.pushPrompt.title")}</Text>
        <Text style={s.subhead}>{t("onboarding.pushPrompt.body")}</Text>

        {/* Mock notification — iOS-banner styled preview of a streak nudge */}
        <Animated.View
          style={[s.mockCard, { transform: [{ translateY: floatY }] }]}
        >
          <View style={s.mockIconWrap}>
            <Image
              source={APP_ICON}
              style={s.mockIcon}
              resizeMode="contain"
              accessibilityLabel="Garzoni"
            />
          </View>
          <View style={s.mockTextWrap}>
            <View style={s.mockTopRow}>
              <Text style={s.mockApp}>Garzoni</Text>
              <Text style={s.mockTime}>
                {t("onboarding.pushPrompt.mockTime")}
              </Text>
            </View>
            <Text style={s.mockTitle}>
              {t("onboarding.pushPrompt.mockTitle")}
            </Text>
            <Text style={s.mockBody} numberOfLines={2}>
              {t("onboarding.pushPrompt.mockBody")}
            </Text>
          </View>
        </Animated.View>
      </View>

      <View style={s.ctaWrap}>
        <Pressable
          onPress={() => void handleAccept()}
          disabled={requesting}
          style={({ pressed }) => [
            s.cta,
            (pressed || requesting) && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
        >
          <View style={s.ctaHighlight} pointerEvents="none" />
          {requesting ? (
            <LoadingSpinner size="sm" color="#fff" />
          ) : (
            <Text style={s.ctaLabel}>{t("onboarding.pushPrompt.cta")}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleDecline}
          disabled={requesting}
          style={s.declineBtn}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={s.declineLabel}>
            {t("onboarding.pushPrompt.notNow")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    overflow: "hidden",
  },
  ambientTop: { position: "absolute", top: -70, alignSelf: "center" },
  ambientBottom: { position: "absolute", bottom: -40, right: -40 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    justifyContent: "flex-start",
  },

  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: C.faint,
    fontWeight: "500",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: C.text,
  },
  subhead: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    maxWidth: 340,
  },

  mockCard: {
    marginTop: 40,
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  mockIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: C.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  mockIcon: { width: 32, height: 32 },
  mockTextWrap: { flex: 1 },
  mockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  mockApp: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: C.faint,
    textTransform: "uppercase",
  },
  mockTime: { fontSize: 12, color: C.faint },
  mockTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.1,
  },
  mockBody: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 19,
    color: C.muted,
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 6,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  declineBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  declineLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "500",
  },
});
