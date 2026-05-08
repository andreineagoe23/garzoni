import { Image, StyleSheet, View } from "react-native";
import { spacing } from "../../theme/tokens";

const LOCAL_LOGO = require("../../../assets/garzoni-logo.png");

/** White rectangular wordmark — uses bundled asset so it always renders (no network needed). */
export default function AuthLogoMark() {
  return (
    <View style={styles.wrap}>
      <Image
        accessibilityLabel="Garzoni"
        accessibilityRole="image"
        source={LOCAL_LOGO}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  image: {
    height: 64,
    width: "92%",
    maxWidth: 340,
  },
});
