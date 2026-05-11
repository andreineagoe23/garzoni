import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  inferCoingeckoIdFromSymbol,
} from "../../../types/portfolio";
import type { NewEntryForm } from "../../../types/portfolio";
import { apiClient } from "@garzoni/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchMarketQuoteFresh,
  getMarketQuoteQueryOptions,
} from "../../../hooks/useMarketQuote";
import { useBottomSheetVerticalHandle } from "../../../hooks/useBottomSheetVerticalHandle";
import KeyboardAwareScrollView from "../../../components/ui/KeyboardAwareScrollView";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP_PARTIAL = SCREEN_HEIGHT * 0.75;
const SNAP_FULL = SCREEN_HEIGHT * 0.95;
/** translateY when sheet is at partial / full snap (smaller Y = more expanded). */
const Y_PARTIAL = SCREEN_HEIGHT - SNAP_PARTIAL;
const Y_FULL = SCREEN_HEIGHT - SNAP_FULL;
const Y_HIDDEN = SCREEN_HEIGHT;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  isPaperTrade?: boolean;
  onFirstTrade?: (xpGained: number) => void;
};

const EMPTY_FORM: NewEntryForm = {
  asset_type: "stock",
  symbol: "",
  quantity: "",
  purchase_price: "",
  purchase_date: new Date().toISOString().split("T")[0],
};

function isValidIsoDate(raw: string): boolean {
  if (!ISO_DATE_RE.test(raw)) return false;
  const [y, m, d] = raw.split("-").map((p) => Number(p));
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

function isFutureIsoDate(raw: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return raw > today;
}

export function AddEntrySheet({
  visible,
  onClose,
  onAdded,
  isPaperTrade = false,
  onFirstTrade,
}: Props) {
  const c = useThemeColors();
  const queryClient = useQueryClient();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<NewEntryForm>(EMPTY_FORM);
  const [lookupPrice, setLookupPrice] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState<
    { symbol: string; name: string; type: string; coingecko_id?: string }[]
  >([]);
  const [selectedCoingeckoId, setSelectedCoingeckoId] = useState<string | null>(
    null,
  );
  const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);
  const symbolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSymbolQueryRef = useRef("");

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

  useEffect(() => {
    return () => {
      if (symbolDebounceRef.current) clearTimeout(symbolDebounceRef.current);
    };
  }, []);

  const dismissAndClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const scrollFocusedFieldIntoView = useCallback(() => {
    expandFull();
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 280);
    });
  }, [expandFull]);

  const { panHandlers: sheetPanHandlers } = useBottomSheetVerticalHandle({
    translateY,
    yExpanded: Y_FULL,
    yCollapsed: Y_PARTIAL,
    yHidden: Y_HIDDEN,
    screenHeight: SCREEN_HEIGHT,
    onDismiss: onClose,
    onTapExpand: expandFull,
  });

  const handleSymbolQueryChange = useCallback((value: string) => {
    setSymbolQuery(value);
    setForm((prev) => ({ ...prev, symbol: value }));
    setLookupPrice(null);
    setLookupError(null);
    setSelectedCoingeckoId(null);
    latestSymbolQueryRef.current = value.trim();

    if (symbolDebounceRef.current) clearTimeout(symbolDebounceRef.current);

    if (value.trim().length < 2) {
      setSymbolResults([]);
      return;
    }

    symbolDebounceRef.current = setTimeout(async () => {
      const requestedQuery = value.trim();
      setSymbolSearchLoading(true);
      try {
        const res = await (apiClient as any).get("/asset-search/", {
          params: { q: requestedQuery },
        });
        if (latestSymbolQueryRef.current === requestedQuery) {
          setSymbolResults(res.data ?? []);
        }
      } catch {
        if (latestSymbolQueryRef.current === requestedQuery) {
          setSymbolResults([]);
        }
      } finally {
        if (latestSymbolQueryRef.current === requestedQuery) {
          setSymbolSearchLoading(false);
        }
      }
    }, 350);
  }, []);

  const handleSelectAsset = useCallback(
    async (asset: {
      symbol: string;
      name: string;
      type: string;
      coingecko_id?: string;
    }) => {
      Keyboard.dismiss();
      setSymbolQuery(asset.symbol);
      setSymbolResults([]);
      latestSymbolQueryRef.current = asset.symbol;
      setSelectedCoingeckoId(asset.coingecko_id || null);
      setForm((prev) => ({
        ...prev,
        symbol: asset.symbol,
        asset_type: asset.type,
      }));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setLookupLoading(true);
      setLookupError(null);
      try {
        const data = await queryClient.fetchQuery({
          ...getMarketQuoteQueryOptions({
            ticker: asset.symbol,
            coingeckoId: asset.coingecko_id,
          }),
        });
        const price = data?.price ?? null;
        if (price != null && Number(price) > 0) {
          setLookupPrice(Number(price));
          // Keep user-entered buy price intact for historical P&L basis.
          setForm((prev) =>
            prev.purchase_price.trim()
              ? prev
              : { ...prev, purchase_price: String(price) },
          );
        } else {
          setLookupError("Price not found for that symbol");
        }
      } catch {
        setLookupError("Could not fetch price");
      } finally {
        setLookupLoading(false);
      }
    },
    [queryClient],
  );

  const handleAssetTypePicker = useCallback(() => {
    const options = ASSET_TYPES.map((t) => t.label);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, "Cancel"], cancelButtonIndex: options.length },
        (idx) => {
          if (idx < options.length) {
            setForm((prev) => ({
              ...prev,
              asset_type: ASSET_TYPES[idx].value,
            }));
          }
        },
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
      const inferredCryptoId =
        assetType === "crypto"
          ? selectedCoingeckoId || inferCoingeckoIdFromSymbol(symbol)
          : null;

      const data = await queryClient.fetchQuery({
        ...getMarketQuoteQueryOptions({
          ticker: symbol.toUpperCase(),
          coingeckoId: inferredCryptoId,
        }),
      });
      const price = data?.price ?? null;
      if (price != null && Number(price) > 0) {
        setLookupPrice(Number(price));
        setForm((prev) => ({
          ...prev,
          purchase_price: prev.purchase_price.trim()
            ? prev.purchase_price
            : String(price),
          asset_type: inferredCryptoId ? "crypto" : prev.asset_type,
        }));
        if (inferredCryptoId) {
          setSelectedCoingeckoId(inferredCryptoId);
        }
      } else {
        setLookupError("Price not found for that symbol");
      }
    } catch {
      setLookupError("Could not fetch price");
    } finally {
      setLookupLoading(false);
    }
  }, [form.symbol, form.asset_type, selectedCoingeckoId, queryClient]);

  const handleLookupPriceFresh = useCallback(async () => {
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
      const inferredCryptoId =
        assetType === "crypto"
          ? selectedCoingeckoId || inferCoingeckoIdFromSymbol(symbol)
          : null;
      const data = await fetchMarketQuoteFresh(queryClient, {
        ticker: symbol.toUpperCase(),
        coingeckoId: inferredCryptoId,
      });
      const price = data?.price ?? null;
      if (price != null && Number(price) > 0) {
        setLookupPrice(Number(price));
        setForm((prev) => ({
          ...prev,
          purchase_price: prev.purchase_price.trim()
            ? prev.purchase_price
            : String(price),
          asset_type: inferredCryptoId ? "crypto" : prev.asset_type,
        }));
        if (inferredCryptoId) setSelectedCoingeckoId(inferredCryptoId);
      } else {
        setLookupError("Price not found for that symbol");
      }
    } catch {
      setLookupError("Could not fetch price");
    } finally {
      setLookupLoading(false);
    }
  }, [form.symbol, form.asset_type, selectedCoingeckoId, queryClient]);

  const handleSubmit = useCallback(async () => {
    if (!form.symbol.trim() || !form.quantity || !form.purchase_price) {
      setSubmitError("Symbol, quantity, and purchase price are required");
      return;
    }
    const dateInput = form.purchase_date.trim();
    if (!isValidIsoDate(dateInput)) {
      setSubmitError("Purchase date must be valid and use YYYY-MM-DD format");
      return;
    }
    if (isFutureIsoDate(dateInput)) {
      setSubmitError("Purchase date cannot be in the future");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let xpGained = 0;
      if (isPaperTrade) {
        const amountToSpend =
          parseFloat(form.quantity) * parseFloat(form.purchase_price);
        const coingeckoId =
          selectedCoingeckoId ||
          (form.asset_type === "crypto"
            ? inferCoingeckoIdFromSymbol(form.symbol)
            : null);
        const res = await (apiClient as any).post("/paper-trade/buy/", {
          symbol: form.symbol.trim().toUpperCase(),
          amount_to_spend: amountToSpend,
          ...(coingeckoId ? { coingecko_id: coingeckoId } : {}),
        });
        xpGained = res.data?.xp_gained ?? 0;
      } else {
        await (apiClient as any).post("/portfolio/", {
          asset_type: form.asset_type,
          symbol: form.symbol.trim(),
          quantity: parseFloat(form.quantity),
          purchase_price: parseFloat(form.purchase_price),
          purchase_date: dateInput,
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForm(EMPTY_FORM);
      setSymbolQuery("");
      setSymbolResults([]);
      setSelectedCoingeckoId(null);
      setLookupPrice(null);
      onAdded();
      onClose();
      if (xpGained > 0) onFirstTrade?.(xpGained);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error;
      setSubmitError(msg || "Failed to add entry");
    } finally {
      setSubmitting(false);
    }
  }, [form, isPaperTrade, onAdded, onClose, onFirstTrade]);

  const currentAssetLabel =
    ASSET_TYPES.find((t) => t.value === form.asset_type)?.label ?? "Stock";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissAndClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={dismissAndClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle — drag vertically to resize / dismiss; short tap expands */}
        <View
          style={styles.handleArea}
          {...sheetPanHandlers}
          accessibilityLabel="Resize sheet"
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        <View style={styles.sheetBody}>
          <KeyboardAwareScrollView
            ref={scrollRef}
            keyboardActive={visible}
            basePaddingBottom={spacing.xl}
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
                  style={[
                    styles.input,
                    styles.selectBtn,
                    { backgroundColor: c.inputBg, borderColor: c.border },
                  ]}
                >
                  <Text style={[styles.inputText, { color: c.text }]}>
                    {currentAssetLabel}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: typography.sm }}>
                    ▾
                  </Text>
                </Pressable>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                >
                  {ASSET_TYPES.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, asset_type: t.value }))
                      }
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.asset_type === t.value
                              ? c.primary
                              : c.surfaceOffset,
                          borderColor:
                            form.asset_type === t.value ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color:
                              form.asset_type === t.value
                                ? c.textOnPrimary
                                : c.textMuted,
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </FieldLabel>

            {/* Symbol + autocomplete */}
            <FieldLabel label="Symbol">
              <View style={styles.symbolRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.symbolInput,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      color: c.text,
                    },
                  ]}
                  placeholder="Search Apple, BTC, TSLA…"
                  placeholderTextColor={c.textFaint}
                  value={symbolQuery}
                  onChangeText={handleSymbolQueryChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={() => {
                    void handleLookupPrice();
                  }}
                  disabled={lookupLoading || !form.symbol.trim()}
                  style={({ pressed }) => [
                    styles.lookupBtn,
                    {
                      backgroundColor: c.primary,
                      opacity:
                        lookupLoading || !form.symbol.trim()
                          ? 0.4
                          : pressed
                            ? 0.8
                            : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.lookupBtnText, { color: c.textOnPrimary }]}
                  >
                    {lookupLoading ? "…" : "Get Price"}
                  </Text>
                </Pressable>
              </View>
              {(symbolResults.length > 0 || symbolSearchLoading) && (
                <View
                  style={[
                    styles.dropdown,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  {symbolSearchLoading && (
                    <Text style={[styles.dropdownHint, { color: c.textMuted }]}>
                      Searching…
                    </Text>
                  )}
                  {symbolResults.map((asset, idx) => (
                    <Pressable
                      key={`${asset.symbol}-${idx}`}
                      onPress={() => void handleSelectAsset(asset)}
                      style={({ pressed }) => [
                        styles.dropdownRow,
                        idx < symbolResults.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: c.border,
                        },
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.dropdownSymbol, { color: c.text }]}
                        >
                          {asset.symbol}
                        </Text>
                        <Text
                          style={[styles.dropdownName, { color: c.textMuted }]}
                          numberOfLines={1}
                        >
                          {asset.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: c.primary + "20" },
                        ]}
                      >
                        <Text
                          style={[styles.typeBadgeText, { color: c.primary }]}
                        >
                          {asset.type.toUpperCase()}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {lookupError && (
                <View>
                  <Text style={[styles.fieldError, { color: c.error }]}>
                    {lookupError}
                  </Text>
                  <Pressable
                    onPress={() => {
                      void handleLookupPriceFresh();
                    }}
                    disabled={lookupLoading || !form.symbol.trim()}
                    style={({ pressed }) => [
                      styles.freshQuoteLink,
                      {
                        opacity:
                          lookupLoading || !form.symbol.trim()
                            ? 0.4
                            : pressed
                              ? 0.7
                              : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.freshQuoteLinkText, { color: c.primary }]}
                    >
                      Fetch fresh quote
                    </Text>
                  </Pressable>
                </View>
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
                style={[
                  styles.input,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
                placeholder="e.g. 10"
                placeholderTextColor={c.textFaint}
                value={form.quantity}
                onChangeText={(v) =>
                  setForm((prev) => ({ ...prev, quantity: v }))
                }
                keyboardType="decimal-pad"
                returnKeyType="done"
                onFocus={scrollFocusedFieldIntoView}
              />
            </FieldLabel>

            {/* Purchase Price */}
            <FieldLabel label="Purchase Price (USD)">
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
                placeholder="e.g. 185.00"
                placeholderTextColor={c.textFaint}
                value={form.purchase_price}
                onChangeText={(v) =>
                  setForm((prev) => ({ ...prev, purchase_price: v }))
                }
                keyboardType="decimal-pad"
                returnKeyType="done"
                onFocus={scrollFocusedFieldIntoView}
              />
              <Text style={[styles.fieldHint, { color: c.textMuted }]}>
                This is your buy price (cost basis). "Get Price" does not
                overwrite it once you edit it.
              </Text>
            </FieldLabel>

            {/* Purchase Date */}
            <FieldLabel label="Purchase Date (YYYY-MM-DD)">
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
                placeholder="2024-01-15"
                placeholderTextColor={c.textFaint}
                value={form.purchase_date}
                onChangeText={(v) =>
                  setForm((prev) => ({ ...prev, purchase_date: v }))
                }
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                maxLength={10}
                onFocus={scrollFocusedFieldIntoView}
              />
              <Text style={[styles.fieldHint, { color: c.textMuted }]}>
                Profit/Loss is computed from your buy price until now.
              </Text>
            </FieldLabel>

            {submitError && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: c.errorBg, borderColor: c.error },
                ]}
              >
                <Text style={[styles.errorText, { color: c.error }]}>
                  {submitError}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => {
                void handleSubmit();
              }}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: c.primary,
                  opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add holding"
            >
              <Text style={[styles.submitText, { color: c.textOnPrimary }]}>
                {submitting ? "Adding…" : "Add Holding"}
              </Text>
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
    justifyContent: "center",
    paddingVertical: spacing.lg,
    minHeight: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetBody: { flex: 1 },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
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
  freshQuoteLink: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  freshQuoteLinkText: {
    fontSize: typography.sm,
    fontWeight: "700",
    textDecorationLine: "underline",
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
  dropdown: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dropdownSymbol: { fontSize: typography.sm, fontWeight: "700" },
  dropdownName: { fontSize: typography.xs },
  dropdownHint: { fontSize: typography.xs, padding: spacing.md },
  typeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
