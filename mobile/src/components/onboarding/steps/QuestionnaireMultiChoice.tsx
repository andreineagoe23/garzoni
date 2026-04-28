import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { QuestionnaireQuestion } from "@garzoni/core";
import { brand } from "../../../theme/brand";

type Props = {
  question: QuestionnaireQuestion;
  selected: string[];
  onChange: (v: string[]) => void;
};

const DARK = {
  surface: brand.bgCard,
  primaryBright: brand.greenBright,
  primarySoft: "rgba(29,83,48,0.18)",
  gold: brand.gold,
  border: brand.borderGlass,
  text: brand.text,
  bg: brand.bgDark,
};

export default function QuestionnaireMultiChoice({
  question,
  selected,
  onChange,
}: Props) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val],
    );
  };
  return (
    <View style={styles.list}>
      {(question.options ?? []).map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={[
              styles.card,
              {
                backgroundColor: active ? DARK.primarySoft : DARK.surface,
                borderColor: active ? DARK.primaryBright : DARK.border,
                transform: [{ translateY: active ? -1 : 0 }],
              },
            ]}
          >
            <View style={styles.labelCol}>
              <Text style={styles.label}>{opt.label}</Text>
            </View>
            <View
              style={[
                styles.check,
                {
                  backgroundColor: active ? DARK.gold : "transparent",
                  borderColor: active ? DARK.gold : DARK.border,
                },
              ]}
            >
              {active ? (
                <Svg width={10} height={10} viewBox="0 0 10 10">
                  <Path
                    d="M2 5l2 2 4-4.5"
                    stroke={DARK.bg}
                    strokeWidth={1.8}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 64,
  },
  labelCol: { flex: 1 },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: DARK.text,
    letterSpacing: -0.2,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
