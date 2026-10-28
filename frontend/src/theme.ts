import { useSyncExternalStore } from "react";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "theme"; // also read by the script in index.html, before the first paint

const system = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
let chosen = stored();

/** The theme picked with the switch on an earlier visit, if any. Storage can be blocked or empty. */
function stored(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme === value);
  } catch {
    return undefined;
  }
}

/** The theme in effect: the choice, else the system's, which can change while the page is open. */
export function currentTheme(): Theme {
  return chosen ?? (system.matches ? "dark" : "light");
}

/** Switch and remember the choice; from then on it wins over the system's. */
export function chooseTheme(theme: Theme) {
  chosen = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembered then; the switch still works for this visit.
  }
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

/** The theme in effect, for the switch to show it as pressed. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  system.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    system.removeEventListener("change", listener);
  };
}
