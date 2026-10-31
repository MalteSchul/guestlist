import { useSyncExternalStore } from "react";

/** A choice from the settings, kept in the browser's storage for the next visit: one of `values`,
 * or none. Storage can be blocked, empty or hold something else; then there is no choice.
 * Components that show it with `use` render again when it changes. */
export function storedChoice<T extends string>(key: string, values: readonly T[]) {
  const listeners = new Set<() => void>();
  let value = read();

  function read(): T | undefined {
    try {
      const stored = localStorage.getItem(key);
      return values.find((v) => v === stored);
    } catch {
      return undefined;
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    get: () => value,
    /** Switch and remember it; `undefined` forgets the choice. */
    set(next: T | undefined) {
      value = next;
      try {
        if (next) localStorage.setItem(key, next);
        else localStorage.removeItem(key);
      } catch {
        // Not remembered then; the choice still holds for this visit.
      }
      listeners.forEach((listener) => listener());
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}
