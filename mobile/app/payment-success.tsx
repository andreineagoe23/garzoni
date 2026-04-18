import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { href } from "../src/navigation/href";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Legacy: web checkout used to land here. Success URL now opens personalized-path
 * directly; keep instant redirect for old links / deep links.
 */
export default function PaymentSuccessScreen() {
  const { t } = useTranslation("common");
  const params = useLocalSearchParams<{
    session_id?: string | string[];
  }>();
  const sessionId =
    Platform.OS === "web" ? firstParam(params.session_id) : undefined;

  useLayoutEffect(() => {
    if (Platform.OS !== "web") {
      router.replace(href("/personalized-path"));
      return;
    }
    if (sessionId) {
      router.replace(
        href(
          `/personalized-path?session_id=${encodeURIComponent(sessionId)}`,
        ),
      );
    } else {
      router.replace(href("/personalized-path"));
    }
  }, [sessionId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("subscriptions.paymentSuccess.title" as never),
          headerShown: Platform.OS !== "web",
        }}
      />
    </>
  );
}
