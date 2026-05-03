/**
 * Receipt / Statement Scan — Pro-only screen.
 * Pick image → GPT-4o vision analysis → spending breakdown + lesson recommendation.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { fetchEntitlements, queryKeys, staleTimes } from "@garzoni/core";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import type { ThemeColors } from "../src/theme/palettes";

type Category = {
  name: string;
  amount: number;
  percent: number;
  emoji: string;
};
type Lesson = { title: string; content_id: number; content_type: string };
type ScanResult = {
  categories: Category[];
  insight: string;
  tip: string;
  recommended_lessons: Lesson[];
};

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
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
    closeText: { fontSize: typography.md, color: c.textMuted },
    scroll: { flex: 1, padding: spacing.lg },
    pickBtn: {
      backgroundColor: c.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    pickBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: typography.base,
    },
    card: {
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: c.accent,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    bodyText: { fontSize: typography.base, color: c.text, lineHeight: 22 },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    categoryName: { fontSize: typography.base, color: c.text, flex: 1 },
    categoryPct: { fontSize: typography.sm, color: c.textMuted },
    lessonItem: {
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border + "40",
    },
    lessonText: {
      fontSize: typography.base,
      color: c.accent,
      fontWeight: "600",
    },
    proGate: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    proTitle: {
      fontSize: typography.lg,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
    },
    proBody: {
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

export default function Scan() {
  const c = useThemeColors();
  const styles = createStyles(c);
  const { t } = useTranslation("common");

  const { data: entitlementsRaw } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const entitlements = entitlementsRaw;
  const scanEntitlement = entitlements?.features?.ai_scan;
  const canScan = scanEntitlement?.enabled === true;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const pickAndScan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Photo library access is needed to scan receipts.",
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      const uri = asset.uri;
      const mimeType = asset.mimeType || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      formData.append("image", {
        uri,
        name: `receipt.${ext}`,
        type: mimeType,
      } as any);

      const res = await apiClient.post("/scan/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Could not scan image.";
      Alert.alert("Scan failed", msg);
    } finally {
      setLoading(false);
    }
  };

  if (!canScan) {
    return (
      <View style={styles.proGate}>
        <Text style={styles.proTitle}>Receipt Scan is Pro-only</Text>
        <Text style={styles.proBody}>
          Upgrade to Pro to scan receipts and statements. Garzoni will analyse
          your spending and recommend the perfect lesson.
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
        <Text style={styles.title}>Scan Receipt</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <Pressable
          style={styles.pickBtn}
          onPress={pickAndScan}
          disabled={loading}
        >
          <Text style={styles.pickBtnText}>
            {loading ? "Analysing…" : "Pick Photo / Receipt"}
          </Text>
        </Pressable>

        {loading && (
          <View style={{ alignItems: "center", marginTop: spacing.xl }}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text
              style={[
                styles.bodyText,
                { marginTop: spacing.sm, color: c.textMuted },
              ]}
            >
              Garzoni is reading your spending…
            </Text>
          </View>
        )}

        {result && (
          <>
            {/* Insight */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Spending Insight</Text>
              <Text style={styles.bodyText}>{result.insight}</Text>
            </View>

            {/* Categories */}
            {result.categories?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Breakdown</Text>
                {result.categories.map((cat, i) => (
                  <View key={i} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>
                      {cat.emoji} {cat.name}
                    </Text>
                    <Text style={styles.categoryPct}>{cat.percent}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Tip */}
            {result.tip && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Garzoni's Tip</Text>
                <Text style={styles.bodyText}>{result.tip}</Text>
              </View>
            )}

            {/* Recommended lessons */}
            {result.recommended_lessons?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Lessons for You</Text>
                {result.recommended_lessons.map((lesson, i) => (
                  <View key={i} style={styles.lessonItem}>
                    <Text style={styles.lessonText}>{lesson.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
