import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../theme/tokens";

export type SelectMenuOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

type TriggerLayout = { x: number; y: number; width: number; height: number };

export default function SelectMenu({
  label,
  value,
  options,
  onChange,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<TriggerLayout | null>(
    null,
  );
  const triggerRef = useRef<View>(null);
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  const handleOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height });
      setOpen(true);
    });
  };

  // Position the dropdown just below the trigger.
  // If it would overflow the bottom, flip it above.
  const DROPDOWN_MAX_HEIGHT = Math.min(options.length * 52 + 16, 320);
  const dropdownTop = triggerLayout
    ? triggerLayout.y + triggerLayout.height + 4
    : 0;
  const overflows =
    dropdownTop + DROPDOWN_MAX_HEIGHT > screenHeight - insets.bottom - 16;
  const dropdownY = triggerLayout
    ? overflows
      ? triggerLayout.y - DROPDOWN_MAX_HEIGHT - 4
      : dropdownTop
    : 0;
  const dropdownLeft = triggerLayout ? triggerLayout.x : 0;
  const dropdownWidth = triggerLayout ? triggerLayout.width : 200;

  return (
    <View style={style}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <View ref={triggerRef}>
        <Pressable
          onPress={handleOpen}
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
          <Text
            style={[styles.triggerText, { color: c.text }]}
            numberOfLines={1}
          >
            {currentLabel}
          </Text>
          <MaterialCommunityIcons
            name={open ? "chevron-up" : "chevron-down"}
            size={22}
            color={c.textMuted}
          />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.dropdown,
            {
              top: dropdownY,
              left: dropdownLeft,
              width: dropdownWidth,
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: DROPDOWN_MAX_HEIGHT,
              ...shadows.md,
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
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
                    selected && { backgroundColor: c.primarySoft },
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
                      size={18}
                      color={c.primary}
                    />
                  ) : (
                    <View style={{ width: 18 }} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdown: {
    position: "absolute",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  optionText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: "500",
  },
});
