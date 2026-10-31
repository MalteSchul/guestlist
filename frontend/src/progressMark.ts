import { storedChoice } from "./storedChoice";

/** How an invite shows how far it is: the coloured bar on its card, an icon, or both. */
export const PROGRESS_MARKS = ["bar", "icon", "both"] as const;
type ProgressMark = (typeof PROGRESS_MARKS)[number];

/** The icon, since colour alone is lost on anyone who can't tell red from green. */
const DEFAULT: ProgressMark = "icon";

const mark = storedChoice("progress-mark", PROGRESS_MARKS);

/** Switch and remember the choice. */
export function chooseProgressMark(choice: ProgressMark) {
  mark.set(choice);
}

export function useProgressMark(): ProgressMark {
  return mark.use() ?? DEFAULT;
}
