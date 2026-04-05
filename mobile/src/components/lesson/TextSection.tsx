import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";
import YoutubePlayer from "react-native-youtube-iframe";
import { getMediaBaseUrl } from "@monevo/core";
import { spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

type TextSectionProps = {
  html?: string;
  fallbackText?: string;
  /** Multiplier for body / HTML text (reading comfort). */
  fontScale?: number;
};

function fixImagePaths(html: string): string {
  const base = getMediaBaseUrl();
  return html.replace(
    /src="\/media\/([^"]+)"/g,
    (_: string, filename: string) => `src="${base}/media/${filename}"`
  );
}

function extractYoutubeId(html: string): string | null {
  const m = html.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return m?.[1] ?? null;
}

const systemFonts = ["-apple-system", "system-ui", "sans-serif"];

function createPlainStyles(c: ThemeColors, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1 },
    plain: {
      fontSize: typography.base * fontScale,
      lineHeight: 24 * fontScale,
      color: c.text,
    },
    empty: {
      fontSize: typography.base * fontScale,
      color: c.textMuted,
      fontStyle: "italic",
    },
    videoBox: {
      marginTop: spacing.lg,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: c.black,
    },
  });
}

export default function TextSection({
  html,
  fallbackText,
  fontScale = 1,
}: TextSectionProps) {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = width - spacing.xl * 2;
  const plainStyles = useMemo(() => createPlainStyles(c, fontScale), [c, fontScale]);

  const sourceHtml = html ?? fallbackText ?? "";
  const prepared = useMemo(() => fixImagePaths(sourceHtml), [sourceHtml]);
  const youtubeId = useMemo(() => extractYoutubeId(prepared), [prepared]);

  const tagsStyles = useMemo(
    () => ({
      body: { color: c.text },
      p: {
        marginTop: 0,
        marginBottom: spacing.sm,
        lineHeight: 22 * fontScale,
        color: c.text,
      },
      li: { color: c.text, marginBottom: spacing.xs },
      h1: {
        color: c.text,
        fontSize: typography.xl * fontScale,
        marginBottom: spacing.sm,
      },
      h2: {
        color: c.text,
        fontSize: typography.lg * fontScale,
        marginBottom: spacing.sm,
      },
      h3: {
        color: c.text,
        fontSize: typography.md * fontScale,
        marginBottom: spacing.xs,
      },
      a: { color: c.accent },
    }),
    [c, fontScale]
  );

  const htmlBase = useMemo(
    () => ({
      fontSize: typography.base * fontScale,
      color: c.text,
    }),
    [c, fontScale]
  );

  if (!prepared.trim()) {
    return <Text style={plainStyles.empty}>No content available.</Text>;
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(prepared);

  if (!looksLikeHtml) {
    return (
      <ScrollView style={plainStyles.container}>
        <Text style={plainStyles.plain}>{prepared}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={plainStyles.container}>
      <RenderHTML
        contentWidth={contentWidth}
        source={{ html: prepared }}
        systemFonts={systemFonts}
        baseStyle={htmlBase}
        tagsStyles={tagsStyles}
      />
      {youtubeId ? (
        <View style={plainStyles.videoBox}>
          <YoutubePlayer height={200} width={contentWidth} videoId={youtubeId} />
        </View>
      ) : null}
    </ScrollView>
  );
}
