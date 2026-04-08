import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../ui";
import { colors, spacing, typography } from "../../theme/tokens";

type Props = { children: ReactNode };
type State = { err: Error | null };

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
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.msg}>
            This screen hit an unexpected error. You can try again.
          </Text>
          <Button onPress={() => this.setState({ err: null })}>
            Try again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    padding: spacing.xxxl,
    justifyContent: "center",
    backgroundColor: colors.bg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
  },
  msg: { fontSize: typography.base, color: colors.textMuted, lineHeight: 22 },
});
