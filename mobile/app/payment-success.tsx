import { Stack, router, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import TransitionScreen from "../src/components/common/TransitionScreen";
import { href } from "../src/navigation/href";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{ session_id?: string | string[] }>();
  const sessionId =
    Platform.OS === "web" ? firstParam(params.session_id) : undefined;

  const handleComplete = () => {
    if (sessionId) {
      router.replace(
        href(`/personalized-path?session_id=${encodeURIComponent(sessionId)}`),
      );
    } else {
      router.replace(href("/personalized-path"));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TransitionScreen variant="payment" onComplete={handleComplete} />
    </>
  );
}
