import Constants from "expo-constants";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  referralCode: string;
};

export default function LeaderboardReferralCard({ referralCode }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [copied, setCopied] = useState(false);

  const baseUrl = useMemo(() => {
    const raw = Constants.expoConfig?.extra?.webAppUrl as string | undefined;
    const trimmed = raw?.replace(/\/$/, "").trim();
    return trimmed && trimmed.length > 0 ? trimmed : "https://garzoni.app";
  }, []);

  const referralLink = useMemo(() => {
    if (!referralCode.trim()) return "";
    return `${baseUrl}/welcome?ref=${encodeURIComponent(referralCode.trim())}`;
  }, [baseUrl, referralCode]);

  const shareReferralLink = useCallback(async () => {
    if (!referralLink) {
      Alert.alert("", t("billing.referralUnavailable"));
      return;
    }
    try {
      const result = await Share.share({
        message: referralLink,
        title: t("profile.referral.title"),
      });
      if (result.action === Share.sharedAction) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      Alert.alert("", t("billing.referralUnavailable"));
    }
  }, [referralLink, t]);

  return (
    <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.title, { color: c.text }]}>
        {t("profile.referral.title")}
      </Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        {t("profile.referral.subtitle")}
      </Text>
      <Text style={[styles.label, { color: c.textMuted }]}>
        {t("profile.referral.linkLabel")}
      </Text>
      <View
        style={[
          styles.fieldRow,
          { borderColor: c.border, backgroundColor: c.inputBg },
        ]}
      >
        <TextInput
          value={referralLink || t("billing.referralUnavailable")}
          editable={false}
          selectTextOnFocus
          multiline
          accessibilityLabel={t("profile.referral.linkAria")}
          style={[styles.input, { color: c.text }]}
        />
        <Pressable
          onPress={shareReferralLink}
          disabled={!referralLink}
          style={({ pressed }) => [
            styles.copyBtn,
            {
              opacity: pressed ? 0.9 : referralLink ? 1 : 0.5,
              backgroundColor: copied ? `${c.accent}22` : c.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.copyBtnText,
              { color: copied ? c.accent : c.textOnPrimary },
            ]}
          >
            {copied
              ? t("profile.referral.shared")
              : t("profile.referral.shareLink")}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.md, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: spacing.sm, lineHeight: 20 },
  label: {
    marginTop: spacing.lg,
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldRow: {
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  input: { fontSize: typography.sm, fontWeight: "600", minHeight: 40 },
  copyBtn: {
    alignSelf: "stretch",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    alignItems: "center",
  },
  copyBtnText: { fontSize: typography.sm, fontWeight: "700" },
});
