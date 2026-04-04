import React, { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import YoutubePlayer from "react-native-youtube-iframe";
import { spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

function youtubeIdFromUrl(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return m?.[1] ?? null;
}

type Props = {
  url?: string;
  title?: string;
};

function createVideoStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    title: {
      fontSize: typography.md,
      fontWeight: "600",
      color: c.text,
      marginBottom: spacing.sm,
    },
    box: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: c.black,
      alignSelf: "center",
    },
    muted: { color: c.textMuted, fontSize: typography.sm },
    err: { color: c.error, marginTop: spacing.sm, fontSize: typography.sm },
  });
}

export default function VideoSection({ url, title }: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createVideoStyles(c), [c]);
  const { width } = useWindowDimensions();
  const w = width - spacing.xl * 2;
  const h = Math.round((w * 9) / 16);
  const [err, setErr] = useState<string | null>(null);

  const yid = useMemo(() => (url ? youtubeIdFromUrl(url) : null), [url]);

  if (!url?.trim()) {
    return <Text style={styles.muted}>No video URL.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {yid ? (
        <View style={[styles.box, { width: w, height: h }]}>
          <YoutubePlayer height={h} width={w} videoId={yid} />
        </View>
      ) : (
        <Video
          style={[styles.box, { width: w, height: h }]}
          source={{ uri: url }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          onError={() => setErr("Could not play this video.")}
        />
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}
