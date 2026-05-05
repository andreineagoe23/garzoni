import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  AVATAR_STYLES,
  getDicebearUrl,
  queryKeys,
  randomSeed,
  updateAvatar,
} from "@garzoni/core";
import { Button } from "../ui";
import {
  isCloudinaryUploadConfigured,
  uploadImageToCloudinary,
} from "../../services/cloudinaryUpload";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import LoadingSpinner from "../ui/LoadingSpinner";

type Tab = "photo" | "prebuilt";

type Props = {
  visible: boolean;
  currentAvatar?: string | null;
  onClose: () => void;
  onAvatarChange?: (url: string) => void;
};

const QUICK_COUNT = 5;

export default function AvatarSelectorMobile({
  visible,
  currentAvatar,
  onClose,
  onAvatarChange,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("prebuilt");
  const [selectedStyle, setSelectedStyle] = useState<string>(
    AVATAR_STYLES[0].id,
  );
  const [seed, setSeed] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);

  const uploadEnabled = isCloudinaryUploadConfigured();

  useEffect(() => {
    if (!visible) return;
    let style = selectedStyle;
    let s = seed;
    if (currentAvatar) {
      const m = currentAvatar.match(
        /avatars\.dicebear\.com\/(?:api|7\.x)\/([^/]+)\/([^.]+)/,
      );
      if (m && m.length >= 3) {
        style = m[1];
        s = decodeURIComponent(m[2]);
      }
    }
    if (!s) s = randomSeed();
    setSelectedStyle(style);
    setSeed(s);
    setPreviewUrl(getDicebearUrl(style, s));
    setLocalPhotoUri(null);
    setTab("prebuilt");
    setSaving(false);
  }, [visible, currentAvatar]);

  useEffect(() => {
    if (tab !== "prebuilt" || !seed) return;
    setPreviewUrl(getDicebearUrl(selectedStyle, seed));
  }, [selectedStyle, seed, tab]);

  const quickOptions = useMemo(() => {
    if (!visible) return [];
    return Array.from({ length: QUICK_COUNT }, () => {
      const s = randomSeed();
      return { seed: s, url: getDicebearUrl(selectedStyle, s) };
    });
  }, [visible, selectedStyle]);

  const pickPhoto = useCallback(async () => {
    try {
      setPickerBusy(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({
          type: "error",
          text1: t("profile.avatarSelector.photoPermissionDenied"),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setLocalPhotoUri(asset.uri);
      setPreviewUrl(asset.uri);
    } catch {
      Toast.show({
        type: "error",
        text1: t("profile.avatarSelector.pickError"),
      });
    } finally {
      setPickerBusy(false);
    }
  }, [t]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      let finalUrl: string | null = null;
      if (tab === "photo" && localPhotoUri) {
        if (!uploadEnabled) {
          Toast.show({
            type: "error",
            text1: t("profile.avatarSelector.uploadNotConfigured"),
          });
          return;
        }
        const { secureUrl } = await uploadImageToCloudinary(localPhotoUri);
        finalUrl = secureUrl;
      } else if (tab === "prebuilt" && previewUrl) {
        finalUrl = previewUrl;
      }

      if (!finalUrl) {
        Toast.show({
          type: "error",
          text1: t("profile.avatarSelector.noSelection"),
        });
        return;
      }

      await updateAvatar(finalUrl);
      onAvatarChange?.(finalUrl);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      Toast.show({
        type: "success",
        text1: t("profile.avatarSelector.savedToast"),
      });
      onClose();
    } catch {
      Toast.show({
        type: "error",
        text1: t("profile.avatarSelector.saveError"),
      });
    } finally {
      setSaving(false);
    }
  }, [
    localPhotoUri,
    onAvatarChange,
    onClose,
    previewUrl,
    queryClient,
    saving,
    t,
    tab,
    uploadEnabled,
  ]);

  const canSave =
    !saving &&
    ((tab === "photo" && !!localPhotoUri && uploadEnabled) ||
      (tab === "prebuilt" && !!previewUrl));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <Text style={[styles.title, { color: c.text }]}>
              {t("profile.avatarSelector.title")}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[styles.close, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.tabs, { backgroundColor: c.surfaceOffset }]}>
            <Pressable
              onPress={() => setTab("prebuilt")}
              style={[
                styles.tab,
                tab === "prebuilt" && { backgroundColor: c.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === "prebuilt" ? c.white : c.text },
                ]}
              >
                {t("profile.avatarSelector.tabPrebuilt")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("photo")}
              style={[
                styles.tab,
                tab === "photo" && { backgroundColor: c.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === "photo" ? c.white : c.text },
                ]}
              >
                {t("profile.avatarSelector.tabPhoto")}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.previewWrap}>
              {previewUrl ? (
                <Image
                  source={{ uri: previewUrl }}
                  style={[styles.preview, { borderColor: c.primary }]}
                />
              ) : (
                <View
                  style={[
                    styles.preview,
                    {
                      borderColor: c.border,
                      backgroundColor: c.surfaceOffset,
                    },
                  ]}
                />
              )}
            </View>

            {tab === "prebuilt" ? (
              <>
                <Text style={[styles.label, { color: c.textMuted }]}>
                  {t("profile.avatarSelector.style")}
                </Text>
                <View style={styles.styleRow}>
                  {AVATAR_STYLES.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedStyle(s.id)}
                      style={[
                        styles.styleChip,
                        {
                          borderColor:
                            selectedStyle === s.id ? c.primary : c.border,
                          backgroundColor:
                            selectedStyle === s.id
                              ? c.primarySoft
                              : c.surfaceOffset,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          {
                            color: selectedStyle === s.id ? c.primary : c.text,
                          },
                        ]}
                      >
                        {t(s.nameKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: c.textMuted }]}>
                  {t("profile.avatarSelector.customizationSeed")}
                </Text>
                <TextInput
                  value={seed}
                  onChangeText={setSeed}
                  placeholder={t("profile.avatarSelector.customizePlaceholder")}
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                  style={[
                    styles.seedInput,
                    {
                      color: c.text,
                      borderColor: c.border,
                      backgroundColor: c.inputBg,
                    },
                  ]}
                />

                <View style={styles.quickHeader}>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {t("profile.avatarSelector.quickOptions")}
                  </Text>
                  <Pressable onPress={() => setSeed(randomSeed())}>
                    <Text style={[styles.randomize, { color: c.primary }]}>
                      {t("profile.avatarSelector.randomize")}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.quickGrid}>
                  {quickOptions.map((opt, i) => (
                    <Pressable
                      key={`${opt.seed}-${i}`}
                      onPress={() => setSeed(opt.seed)}
                      style={[
                        styles.quickItem,
                        {
                          borderColor: seed === opt.seed ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: opt.url }}
                        style={styles.quickImage}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.photoBlock}>
                <Button
                  variant="secondary"
                  onPress={() => void pickPhoto()}
                  loading={pickerBusy}
                >
                  {localPhotoUri
                    ? t("profile.avatarSelector.changePhoto")
                    : t("profile.avatarSelector.choosePhoto")}
                </Button>
                {!uploadEnabled ? (
                  <Text
                    style={[styles.warning, { color: c.error }]}
                    numberOfLines={0}
                  >
                    {t("profile.avatarSelector.uploadNotConfigured")}
                  </Text>
                ) : (
                  <Text
                    style={[styles.hint, { color: c.textMuted }]}
                    numberOfLines={0}
                  >
                    {t("profile.avatarSelector.photoHint")}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <Button variant="ghost" onPress={onClose} style={styles.footerBtn}>
              {t("profile.avatarSelector.cancel")}
            </Button>
            <Button
              onPress={handleSave}
              disabled={!canSave}
              loading={saving}
              style={styles.footerBtn}
            >
              {t("profile.avatarSelector.save")}
            </Button>
          </View>

          {saving ? (
            <View style={styles.savingOverlay}>
              <LoadingSpinner size="lg" />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: typography.md, fontWeight: "700" },
  close: { fontSize: typography.lg },
  tabs: {
    flexDirection: "row",
    margin: spacing.lg,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  tabText: { fontSize: typography.sm, fontWeight: "700" },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  previewWrap: { alignItems: "center", marginBottom: spacing.lg },
  preview: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  styleRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  styleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  styleChipText: { fontSize: typography.xs, fontWeight: "600" },
  seedInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
  },
  quickHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  randomize: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: spacing.md,
  },
  quickGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  quickItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  quickImage: { width: 48, height: 48, borderRadius: 24 },
  photoBlock: { gap: spacing.md, marginTop: spacing.sm },
  hint: { fontSize: typography.xs, lineHeight: 18 },
  warning: { fontSize: typography.xs, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { flex: 1 },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
