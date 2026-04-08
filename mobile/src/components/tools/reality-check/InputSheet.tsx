import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import type { RealityCheckForm } from "../../../types/reality-check";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP = SCREEN_HEIGHT * 0.88;

type Props = {
  visible: boolean;
  form: RealityCheckForm;
  onChange: (field: keyof RealityCheckForm, value: string) => void;
  onClose: () => void;
  onCalculate: () => void;
};

export function InputSheet({
  visible,
  form,
  onChange,
  onClose,
  onCalculate,
}: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? SCREEN_HEIGHT - SNAP : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 3,
    }).start();
  }, [visible, translateY]);

  const field = useCallback(
    (
      label: string,
      key: keyof RealityCheckForm,
      placeholder: string,
      hint?: string,
    ) => (
      <View style={fieldStyles.wrapper}>
        <Text style={[fieldStyles.label, { color: c.textMuted }]}>{label}</Text>
        <TextInput
          style={[
            fieldStyles.input,
            {
              backgroundColor: c.inputBg,
              borderColor: c.border,
              color: c.text,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          value={form[key]}
          onChangeText={(v) => onChange(key, v)}
          keyboardType={key === "goalName" ? "default" : "decimal-pad"}
          returnKeyType="done"
        />
        {hint ? (
          <Text style={[fieldStyles.hint, { color: c.textFaint }]}>{hint}</Text>
        ) : null}
      </View>
    ),
    [c, form, onChange],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, transform: [{ translateY }] },
        ]}
      >
        <TouchableOpacity
          style={styles.handleArea}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.title, { color: c.text }]}>Reality Check</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Enter your goal and financial details
            </Text>

            {field("Goal Name", "goalName", "e.g. Emergency fund")}
            {field("Goal Amount ($)", "goalAmount", "e.g. 10000")}
            {field("Timeline (months)", "months", "e.g. 12")}
            {field("Already Saved ($)", "currentSaved", "e.g. 1000")}

            <View style={[styles.sectionDivider, { borderColor: c.border }]}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
                Monthly Income Range
              </Text>
            </View>
            {field(
              "Income Low ($)",
              "incomeLow",
              "e.g. 2800",
              "Your lowest expected monthly income",
            )}
            {field(
              "Income High ($)",
              "incomeHigh",
              "e.g. 3200",
              "Your highest expected monthly income",
            )}

            <View style={[styles.sectionDivider, { borderColor: c.border }]}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
                Monthly Expenses Range
              </Text>
            </View>
            {field(
              "Expenses Low ($)",
              "expenseLow",
              "e.g. 1900",
              "Minimum expected monthly spending",
            )}
            {field(
              "Expenses High ($)",
              "expenseHigh",
              "e.g. 2200",
              "Maximum expected monthly spending",
            )}

            <Pressable
              onPress={onCalculate}
              style={({ pressed }) => [
                styles.calcBtn,
                { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.calcBtnText, { color: c.textOnPrimary }]}>
                Calculate
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.base,
  },
  hint: { fontSize: typography.xs },
});

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  backdropFill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  handleArea: { alignItems: "center", paddingVertical: spacing.md },
  handle: { width: 36, height: 4, borderRadius: 2 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 48 },
  title: { fontSize: typography.xl, fontWeight: "700" },
  subtitle: { fontSize: typography.sm, marginTop: -spacing.xs },
  sectionDivider: {
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  calcBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  calcBtnText: { fontSize: typography.base, fontWeight: "700" },
});
