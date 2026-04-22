import { forwardRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { authLogoWhiteRectangularUrl } from "@garzoni/core";
import { brand } from "../../theme/brand";

export const DARK = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  primarySoft: "rgba(29,83,48,0.18)",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
  error: "#ef4444",
  errorBg: "rgba(239,68,68,0.12)",
};

type GlowProps = {
  width: number;
  height: number;
  color: string;
  opacity?: number;
  stopFar?: number;
  shape?: "circle" | "ellipse";
};
function Glow({
  width,
  height,
  color,
  opacity = 1,
  stopFar = 0.65,
  shape = "ellipse",
}: GlowProps) {
  const id = `authg-${Math.round(width)}-${Math.round(height)}-${color.length}`;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop
            offset={`${stopFar * 100}%`}
            stopColor={color}
            stopOpacity={0}
          />
        </RadialGradient>
      </Defs>
      {shape === "circle" ? (
        <Circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2}
          fill={`url(#${id})`}
        />
      ) : (
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#${id})`}
        />
      )}
    </Svg>
  );
}

function DarkLogo() {
  const uri = authLogoWhiteRectangularUrl({ width: 560 });
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return <Text style={s.logoFallback}>Garzoni</Text>;
  }
  return (
    <Image
      accessibilityLabel="Garzoni"
      source={{ uri }}
      style={s.logo}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

type ShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function AuthDarkShell({
  eyebrow,
  title,
  subtitle,
  children,
}: ShellProps) {
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.root}>
        <View style={s.ambientTop} pointerEvents="none">
          <Glow
            width={460}
            height={320}
            color={DARK.primary}
            opacity={0.2}
            stopFar={0.55}
          />
        </View>
        <View style={s.ambientBottom} pointerEvents="none">
          <Glow
            width={360}
            height={260}
            color={DARK.goldWarm}
            opacity={0.05}
            stopFar={0.5}
          />
        </View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.logoWrap}>
            <DarkLogo />
          </View>

          <View style={s.header}>
            {eyebrow ? (
              <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>
            ) : null}
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={s.form}>{children}</View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Field (shared dark input look) ──────────────────────────────────────────
type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  error?: string;
  rightSlot?: ReactNode;
};
export const DarkField = forwardRef<TextInput, FieldProps>(
  ({ label, error, rightSlot, ...rest }, ref) => (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          ref={ref}
          {...rest}
          placeholderTextColor={DARK.faint}
          style={[
            s.input,
            rightSlot ? { paddingRight: 48 } : null,
            error ? { borderColor: DARK.error } : null,
          ]}
        />
        {rightSlot ? <View style={s.rightSlot}>{rightSlot}</View> : null}
      </View>
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  ),
);
DarkField.displayName = "DarkField";

// ── Primary CTA matching welcome screen ─────────────────────────────────────
export function DarkCta({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={[s.cta, isDisabled && { opacity: 0.65 }]}
    >
      <View style={s.ctaHighlight} pointerEvents="none" />
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={s.ctaLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

// ── Password eye button ─────────────────────────────────────────────────────
export function EyeButton({
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? hideLabel : showLabel}
      style={s.eyeBtn}
    >
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={22}
        color={DARK.muted}
      />
    </Pressable>
  );
}

// ── Error banner ────────────────────────────────────────────────────────────
export function DarkErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={s.errorBanner}>
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────
export function DarkDivider({ label }: { label: string }) {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerText}>{label}</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: DARK.bg },
  ambientTop: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ambientBottom: { position: "absolute", bottom: -40, right: -60 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 56,
  },

  logoWrap: { alignItems: "center", marginBottom: 32 },
  logo: { width: 260, height: 64 },
  logoFallback: {
    fontSize: 36,
    fontWeight: "600",
    color: DARK.text,
    letterSpacing: -0.4,
  },

  header: { marginBottom: 28 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: DARK.faint,
    fontWeight: "500",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: DARK.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: DARK.muted,
    maxWidth: 360,
  },

  form: { gap: 14 },

  fieldWrap: { marginBottom: 2 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: DARK.muted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputWrap: { position: "relative" },
  input: {
    borderWidth: 1,
    borderColor: DARK.border,
    backgroundColor: DARK.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: DARK.text,
  },
  rightSlot: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldError: { fontSize: 12, color: DARK.error, marginTop: 6 },

  eyeBtn: { flex: 1, alignItems: "center", justifyContent: "center" },

  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: DARK.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  errorBanner: {
    borderWidth: 1,
    borderColor: DARK.error,
    backgroundColor: DARK.errorBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  errorText: { color: DARK.error, fontSize: 13 },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: 18 },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DARK.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: DARK.faint,
    letterSpacing: 1,
  },
});
