import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const SHOW_HEARTS_KEY = "monevo:show_hearts_ui";

export function useShowHeartsMobile() {
  const [show, setShow] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.getItem(SHOW_HEARTS_KEY).then((v) => {
        setShow(v !== "0");
      });
    }, [])
  );

  return show;
}
