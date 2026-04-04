import { Redirect } from "expo-router";
import { href } from "../src/navigation/href";

/**
 * Deep link parity with web `/personalized-path`: opens Home with the Personalized path segment selected.
 */
export default function PersonalizedPathRedirectScreen() {
  return <Redirect href={href("/(tabs)/index?segment=personalized")} />;
}
