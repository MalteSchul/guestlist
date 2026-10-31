import { storedChoice } from "./storedChoice";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
/** What the settings offer: a theme, or the system's (the CSS follows it without a choice). */
export type ThemeChoice = Theme | "system";

const theme = storedChoice("theme", THEMES); // the key is also read by index.html, before the first paint

/** Switch and remember the choice; a theme wins over the system's, "system" follows it again. */
export function chooseTheme(choice: ThemeChoice) {
  theme.set(choice === "system" ? undefined : choice);
  const chosen = theme.get();
  if (chosen) document.documentElement.dataset.theme = chosen;
  else delete document.documentElement.dataset.theme;
}

/** The choice, for the settings to show it as picked. */
export function useThemeChoice(): ThemeChoice {
  return theme.use() ?? "system";
}
