import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./de.json";
import en from "./en.json";

export const LANGUAGES = ["de", "en"] as const;

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: navigator.language.toLowerCase().startsWith("de") ? "de" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes already
});
