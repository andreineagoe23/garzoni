import { Redirect } from "expo-router";
import { href } from "../src/navigation/href";

/**
 * Deep link parity with web `/personalized-path`: opens Learn with the Personalized path view selected.
 */
export default function PersonalizedPathRedirectScreen() {
  return <Redirect href={href("/(tabs)/learn?view=personalized")} />;
}
