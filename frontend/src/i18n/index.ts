import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./de.json";
import en from "./en.json";

export const LANGUAGES = ["de", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "language";

/** The language picked in the settings, if any (A21). Storage can be blocked or empty. */
export function chosenLanguage(): Language | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.find((language) => language === stored);
  } catch {
    return undefined;
  }
}

/** The language to show when the page doesn't decide: the choice, else the browser's (A21). */
export function preferredLanguage(): Language {
  return chosenLanguage() ?? (navigator.language.toLowerCase().startsWith("de") ? "de" : "en");
}

/** Switch and remember the choice for the next visit. */
export function chooseLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered then; the choice still holds for this visit.
  }
  void i18n.changeLanguage(language);
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: preferredLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes already
});
