import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { storedChoice } from "../storedChoice";
import de from "./de.json";
import en from "./en.json";

export const LANGUAGES = ["de", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
/** What the settings offer: a language, or the browser's (no choice stored). */
type LanguageChoice = Language | "system";

/** The language picked in the settings, if any (A21). */
const chosen = storedChoice("language", LANGUAGES);

function browserLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The language to show when the page doesn't decide: the choice, else the browser's (A21). */
function preferredLanguage(): Language {
  return chosen.get() ?? browserLanguage();
}

/** Switch and remember the choice for the next visit; "system" follows the browser again. */
export function chooseLanguage(choice: LanguageChoice) {
  chosen.set(choice === "system" ? undefined : choice);
  void i18n.changeLanguage(preferredLanguage());
}

/** The choice, for the settings to show it as picked. */
export function useLanguageChoice(): LanguageChoice {
  return chosen.use() ?? "system";
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
