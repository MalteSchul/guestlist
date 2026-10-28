import { type DependencyList, useEffect, useRef } from "react";

const FIELDS = "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)";

/** For a form that just opened, e.g. with "+" or "Edit": puts the cursor in its first field,
 * and scrolls it, or the card it sits in, fully into view, only as far as needed. The scroll
 * runs again whenever `deps` change, for forms that grow. Once the form is taller than the
 * window, `whenTall` picks what to keep in view instead, e.g. the row being typed in; without
 * it, the browser would show the form's top. Smooth, unless the system asks for reduced
 * motion. */
export function useReveal<T extends HTMLElement>(
  deps: DependencyList = [],
  whenTall?: (el: T) => Element | null | undefined,
) {
  const ref = useRef<T>(null);
  const opened = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!opened.current && !el.contains(document.activeElement)) {
      el.querySelector<HTMLElement>(FIELDS)?.focus({ preventScroll: true });
    }
    opened.current = true;
    const box = el.closest(".card") ?? el;
    // What's left of the window under the header (scroll-padding), less the card's scroll-margin.
    const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const fits = box.getBoundingClientRect().height <= window.innerHeight - header - 32;
    const target = fits ? box : (whenTall?.(el) ?? box);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }, deps); // callers pass the deps, as with useEffect
  return ref;
}
