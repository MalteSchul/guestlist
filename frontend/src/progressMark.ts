import { useSyncExternalStore } from "react";

/** How an invite shows how far it is: the coloured bar on its card, an icon, or both. */
export const PROGRESS_MARKS = ["bar", "icon", "both"] as const;
export type ProgressMark = (typeof PROGRESS_MARKS)[number];

const STORAGE_KEY = "progress-mark";
/** The icon, since colour alone is lost on anyone who can't tell red from green. */
const DEFAULT: ProgressMark = "icon";

const listeners = new Set<() => void>();
let chosen = stored();

/** The choice from an earlier visit, if any. Storage can be blocked or empty. */
function stored(): ProgressMark {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return PROGRESS_MARKS.find((mark) => mark === value) ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** Switch and remember the choice. */
export function chooseProgressMark(mark: ProgressMark) {
  chosen = mark;
  try {
    localStorage.setItem(STORAGE_KEY, mark);
  } catch {
    // Not remembered then; the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useProgressMark(): ProgressMark {
  return useSyncExternalStore(subscribe, () => chosen);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
