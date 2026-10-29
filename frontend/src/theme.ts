import { useSyncExternalStore } from "react";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
/** What the settings offer: a theme, or the system's (the CSS follows it without a choice). */
export type ThemeChoice = Theme | "system";

const STORAGE_KEY = "theme"; // also read by the script in index.html, before the first paint

const listeners = new Set<() => void>();
let chosen = stored();

/** The theme picked in the settings on an earlier visit, if any. Storage can be blocked or empty. */
function stored(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme === value);
  } catch {
    return undefined;
  }
}

/** Switch and remember the choice; a theme wins over the system's, "system" follows it again. */
export function chooseTheme(choice: ThemeChoice) {
  chosen = choice === "system" ? undefined : choice;
  try {
    if (chosen) localStorage.setItem(STORAGE_KEY, chosen);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered then; the choice still holds for this visit.
  }
  if (chosen) document.documentElement.dataset.theme = chosen;
  else delete document.documentElement.dataset.theme;
  listeners.forEach((listener) => listener());
}

/** The choice, for the settings to show it as picked. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => chosen ?? "system");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
