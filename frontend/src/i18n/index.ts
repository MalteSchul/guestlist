import i18n from "i18next";
import { useSyncExternalStore } from "react";
import { initReactI18next } from "react-i18next";

import de from "./de.json";
import en from "./en.json";

export const LANGUAGES = ["de", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
/** What the settings offer: a language, or the browser's (no choice stored). */
export type LanguageChoice = Language | "system";

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

const listeners = new Set<() => void>();
let chosen = chosenLanguage();

function browserLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The language to show when the page doesn't decide: the choice, else the browser's (A21). */
export function preferredLanguage(): Language {
  return chosen ?? browserLanguage();
}

/** Switch and remember the choice for the next visit; "system" follows the browser again. */
export function chooseLanguage(choice: LanguageChoice) {
  chosen = choice === "system" ? undefined : choice;
  try {
    if (chosen) localStorage.setItem(STORAGE_KEY, chosen);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered then; the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
  void i18n.changeLanguage(preferredLanguage());
}

/** The choice, for the settings to show it as picked. */
export function useLanguageChoice(): LanguageChoice {
  return useSyncExternalStore(subscribe, () => chosen ?? "system");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
