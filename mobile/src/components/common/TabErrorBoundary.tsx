import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../ui";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

type Props = { children: ReactNode };
type State = { err: Error | null };

function TabErrorFallback({ onRetry }: { onRetry: () => void }) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.bg, gap: spacing.lg, padding: spacing.xxxl },
      ]}
    >
      <Text style={[styles.title, { color: c.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.msg, { color: c.textMuted }]}>
        This screen hit an unexpected error. You can try again.
      </Text>
      <Button onPress={onRetry}>Try again</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "700",
  },
  msg: { fontSize: typography.base, lineHeight: 22 },
});

export class TabErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("TabErrorBoundary", error.message, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return <TabErrorFallback onRetry={() => this.setState({ err: null })} />;
    }
    return this.props.children;
  }
}
