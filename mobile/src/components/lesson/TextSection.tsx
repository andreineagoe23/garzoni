import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";
import YoutubePlayer from "react-native-youtube-iframe";
import { getMediaBaseUrl } from "@monevo/core";
import { colors, spacing, typography } from "../../theme/tokens";

type TextSectionProps = {
  html?: string;
  fallbackText?: string;
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

export default function TextSection({ html, fallbackText }: TextSectionProps) {
  const { width } = useWindowDimensions();
  const contentWidth = width - spacing.xl * 2;

  const sourceHtml = html ?? fallbackText ?? "";
  const prepared = useMemo(() => fixImagePaths(sourceHtml), [sourceHtml]);
  const youtubeId = useMemo(() => extractYoutubeId(prepared), [prepared]);

  if (!prepared.trim()) {
    return <Text style={styles.empty}>No content available.</Text>;
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(prepared);

  if (!looksLikeHtml) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.plain}>{prepared}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <RenderHTML
        contentWidth={contentWidth}
        source={{ html: prepared }}
        systemFonts={systemFonts}
        baseStyle={styles.htmlBase}
        tagsStyles={{
          body: { color: colors.text },
          p: { marginTop: 0, marginBottom: spacing.sm, lineHeight: 22 },
          li: { color: colors.text, marginBottom: spacing.xs },
          h1: { color: colors.text, fontSize: typography.xl, marginBottom: spacing.sm },
          h2: { color: colors.text, fontSize: typography.lg, marginBottom: spacing.sm },
          h3: { color: colors.text, fontSize: typography.md, marginBottom: spacing.xs },
          a: { color: colors.primary },
        }}
      />
      {youtubeId ? (
        <View style={styles.videoBox}>
          <YoutubePlayer height={200} width={contentWidth} videoId={youtubeId} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  htmlBase: {
    fontSize: typography.base,
    color: colors.text,
  },
  plain: {
    fontSize: typography.base,
    lineHeight: 24,
    color: colors.text,
  },
  empty: {
    fontSize: typography.base,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  videoBox: {
    marginTop: spacing.lg,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.black,
  },
});
