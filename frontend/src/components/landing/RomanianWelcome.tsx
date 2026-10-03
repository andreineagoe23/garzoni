import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18n";
import Welcome from "./Welcome";

// A clone fixed to Romanian: /ro always renders Romanian for every visitor and
// crawler, without switching the reader's own UI language (the clone's language
// changes don't reach the main instance or its persistence listeners).
const roI18n = i18n.cloneInstance({ lng: "ro" });

export default function RomanianWelcome() {
  return (
    <I18nextProvider i18n={roI18n}>
      <Welcome lang="ro" />
    </I18nextProvider>
  );
}
