import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

export type SelectMenuOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

export default function SelectMenu({
  label,
  value,
  options,
  onChange,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const c = useThemeColors();
  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <View style={style}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: c.border,
            backgroundColor: pressed ? c.surfaceElevated : c.surface,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${currentLabel}`}
        accessibilityHint="Opens a list of options"
      >
        <Text style={[styles.triggerText, { color: c.text }]} numberOfLines={1}>
          {currentLabel}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={22}
          color={c.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderTopColor: c.border },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: c.text }]}>{label}</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.sheetScroll}
              bounces={false}
            >
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={[
                      styles.optionRow,
                      { borderBottomColor: c.border },
                      selected && { backgroundColor: c.accentMuted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: c.text },
                        selected && { fontWeight: "800", color: c.primary },
                      ]}
                      numberOfLines={2}
                    >
                      {opt.label}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={22}
                        color={c.primary}
                      />
                    ) : (
                      <View style={{ width: 22 }} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: "600",
    marginBottom: 4,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  triggerText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: "55%",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: typography.md,
    fontWeight: "800",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sheetScroll: {
    maxHeight: 360,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  optionText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: "500",
  },
});
