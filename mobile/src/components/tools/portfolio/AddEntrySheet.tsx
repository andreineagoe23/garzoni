import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  ActionSheetIOS,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import {
  ASSET_TYPES,
  inferAssetType,
  formatCurrency,
} from "../../../types/portfolio";
import type { NewEntryForm } from "../../../types/portfolio";
import { apiClient } from "@monevo/core";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP_PARTIAL = SCREEN_HEIGHT * 0.75;
const SNAP_FULL = SCREEN_HEIGHT * 0.95;

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
};

const EMPTY_FORM: NewEntryForm = {
  asset_type: "stock",
  symbol: "",
  quantity: "",
  purchase_price: "",
  purchase_date: new Date().toISOString().split("T")[0],
};

export function AddEntrySheet({ visible, onClose, onAdded }: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [form, setForm] = useState<NewEntryForm>(EMPTY_FORM);
  const [lookupPrice, setLookupPrice] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - SNAP_PARTIAL,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const expandFull = useCallback(() => {
    Animated.spring(translateY, {
      toValue: SCREEN_HEIGHT - SNAP_FULL,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const handleSymbolChange = useCallback((value: string) => {
    setLookupPrice(null);
    setLookupError(null);
    setForm((prev) => {
      const next = { ...prev, symbol: value };
      if (prev.asset_type === "stock" || prev.asset_type === "crypto") {
        next.asset_type = inferAssetType(value);
      }
      return next;
    });
  }, []);

  const handleAssetTypePicker = useCallback(() => {
    const options = ASSET_TYPES.map((t) => t.label);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, "Cancel"], cancelButtonIndex: options.length },
        (idx) => {
          if (idx < options.length) {
            setForm((prev) => ({ ...prev, asset_type: ASSET_TYPES[idx].value }));
          }
        }
      );
    }
    // Android: inline buttons used (see picker row below)
  }, []);

  const handleLookupPrice = useCallback(async () => {
    const symbol = form.symbol.trim();
    if (!symbol) {
      setLookupError("Enter a symbol first");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupPrice(null);

    try {
      const assetType = form.asset_type || inferAssetType(symbol);
      if (assetType === "crypto") {
        const normalized = symbol.trim().toLowerCase();
        const COINGECKO: Record<string, string> = {
          btc: "bitcoin", bitcoin: "bitcoin", eth: "ethereum", ethereum: "ethereum",
          sol: "solana", solana: "solana", xrp: "ripple", ada: "cardano",
          doge: "dogecoin", bnb: "binancecoin",
        };
        const id = COINGECKO[normalized] || normalized;
        const res = await (apiClient as any).get("/crypto-price/", { params: { id } });
        const price = res.data?.price ?? null;
        if (price != null) {
          setLookupPrice(price);
          setForm((prev) => ({
            ...prev,
            purchase_price: String(price),
            asset_type: "crypto",
          }));
        } else {
          setLookupError("Price not found for that symbol");
        }
      } else {
        const res = await (apiClient as any).get("/stock-price/", {
          params: { symbol: symbol.toUpperCase() },
        });
        const price = res.data?.price ?? null;
        if (price != null) {
          setLookupPrice(price);
          setForm((prev) => ({ ...prev, purchase_price: String(price) }));
        } else {
          setLookupError("Price not found for that symbol");
        }
      }
    } catch {
      setLookupError("Could not fetch price");
    } finally {
      setLookupLoading(false);
    }
  }, [form.symbol, form.asset_type]);

  const handleSubmit = useCallback(async () => {
    if (!form.symbol.trim() || !form.quantity || !form.purchase_price) {
      setSubmitError("Symbol, quantity, and purchase price are required");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await (apiClient as any).post("/portfolio/", {
        asset_type: form.asset_type,
        symbol: form.symbol.trim(),
        quantity: parseFloat(form.quantity),
        purchase_price: parseFloat(form.purchase_price),
        purchase_date: form.purchase_date,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm(EMPTY_FORM);
      setLookupPrice(null);
      onAdded();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error;
      setSubmitError(msg || "Failed to add entry");
    } finally {
      setSubmitting(false);
    }
  }, [form, onAdded, onClose]);

  const currentAssetLabel =
    ASSET_TYPES.find((t) => t.value === form.asset_type)?.label ?? "Stock";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle — tap to expand to full height */}
        <TouchableOpacity
          style={styles.handleArea}
          onPress={expandFull}
          activeOpacity={0.7}
          accessibilityLabel="Expand sheet"
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              Add Holding
            </Text>

            {/* Asset type — iOS ActionSheet / Android inline */}
            <FieldLabel label="Asset Type">
              {Platform.OS === "ios" ? (
                <Pressable
                  onPress={handleAssetTypePicker}
                  style={[styles.input, styles.selectBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <Text style={[styles.inputText, { color: c.text }]}>{currentAssetLabel}</Text>
                  <Text style={{ color: c.textMuted, fontSize: typography.sm }}>▾</Text>
                </Pressable>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {ASSET_TYPES.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() => setForm((prev) => ({ ...prev, asset_type: t.value }))}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.asset_type === t.value ? c.primary : c.surfaceOffset,
                          borderColor:
                            form.asset_type === t.value ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: form.asset_type === t.value ? c.textOnPrimary : c.textMuted },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </FieldLabel>

            {/* Symbol + Get Price */}
            <FieldLabel label="Symbol">
              <View style={styles.symbolRow}>
                <TextInput
                  style={[styles.input, styles.symbolInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                  placeholder="e.g. AAPL, bitcoin"
                  placeholderTextColor={c.textFaint}
                  value={form.symbol}
                  onChangeText={handleSymbolChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={() => { void handleLookupPrice(); }}
                  disabled={lookupLoading || !form.symbol.trim()}
                  style={({ pressed }) => [
                    styles.lookupBtn,
                    {
                      backgroundColor: c.primary,
                      opacity: (lookupLoading || !form.symbol.trim()) ? 0.4 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.lookupBtnText, { color: c.textOnPrimary }]}>
                    {lookupLoading ? "…" : "Get Price"}
                  </Text>
                </Pressable>
              </View>
              {lookupError && (
                <Text style={[styles.fieldError, { color: c.error }]}>{lookupError}</Text>
              )}
              {lookupPrice != null && !lookupError && (
                <Text style={[styles.fieldHint, { color: c.textMuted }]}>
                  Live price: {formatCurrency(lookupPrice)}
                </Text>
              )}
            </FieldLabel>

            {/* Quantity */}
            <FieldLabel label="Quantity">
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                placeholder="e.g. 10"
                placeholderTextColor={c.textFaint}
                value={form.quantity}
                onChangeText={(v) => setForm((prev) => ({ ...prev, quantity: v }))}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </FieldLabel>

            {/* Purchase Price */}
            <FieldLabel label="Purchase Price (USD)">
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                placeholder="e.g. 185.00"
                placeholderTextColor={c.textFaint}
                value={form.purchase_price}
                onChangeText={(v) => setForm((prev) => ({ ...prev, purchase_price: v }))}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </FieldLabel>

            {/* Purchase Date */}
            <FieldLabel label="Purchase Date (YYYY-MM-DD)">
              <TextInput
                style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                placeholder="2024-01-15"
                placeholderTextColor={c.textFaint}
                value={form.purchase_date}
                onChangeText={(v) => setForm((prev) => ({ ...prev, purchase_date: v }))}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                maxLength={10}
              />
            </FieldLabel>

            {submitError && (
              <View style={[styles.errorBox, { backgroundColor: c.errorBg, borderColor: c.error }]}>
                <Text style={[styles.errorText, { color: c.error }]}>{submitError}</Text>
              </View>
            )}

            <Pressable
              onPress={() => { void handleSubmit(); }}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: c.primary, opacity: submitting ? 0.6 : pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add holding"
            >
              <Text style={[styles.submitText, { color: c.textOnPrimary }]}>
                {submitting ? "Adding…" : "Add Holding"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={[fieldStyles.label, { color: c.textMuted }]}>{label}</Text>
      {children}
    </View>
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
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
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
  handleArea: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 48,
  },
  sheetTitle: {
    fontSize: typography.xl,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.base,
  },
  inputText: {
    fontSize: typography.base,
    flex: 1,
  },
  selectBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipScroll: { flexGrow: 0 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: typography.xs,
    fontWeight: "600",
  },
  symbolRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  symbolInput: { flex: 1 },
  lookupBtn: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  lookupBtnText: {
    fontSize: typography.sm,
    fontWeight: "700",
  },
  fieldError: {
    fontSize: typography.xs,
  },
  fieldHint: {
    fontSize: typography.xs,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.sm,
  },
  submitBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitText: {
    fontSize: typography.base,
    fontWeight: "700",
  },
});
