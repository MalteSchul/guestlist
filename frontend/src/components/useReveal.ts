import { useEffect, useRef } from "react";

const FIELDS = "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)";

/** For a form that just opened, e.g. with "+" or "Edit": puts the cursor in its first field and
 * keeps the form, or the card it sits in, in view, scrolling only as far as needed. That holds
 * whenever it grows while the cursor is in it, whatever makes it grow (rows, chips, errors), so
 * forms needn't say what that is. Once it's taller than the window, the field with the cursor
 * stays in view instead; without that, the browser would show the form's top. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.contains(document.activeElement)) {
      el.querySelector<HTMLElement>(FIELDS)?.focus({ preventScroll: true });
    }
    const box = el.closest(".card") ?? el;
    let height = 0; // the first call, right after observe(), is the opening
    const observer = new ResizeObserver(() => {
      const opening = height === 0;
      const grown = box.getBoundingClientRect().height > height;
      height = box.getBoundingClientRect().height;
      // Shrinking never hides anything, and a form that was left shouldn't pull the page back.
      if (!grown || (!opening && !el.contains(document.activeElement))) return;
      // What's left of the window under the header (scroll-padding), less the card's scroll-margin.
      const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const fits = height <= window.innerHeight - header - 32;
      const focused = el.contains(document.activeElement) ? document.activeElement : null;
      scrollIntoViewGently(fits ? box : (focused ?? box));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/** Scrolls `el` into view only as far as needed; smooth, unless the system asks for reduced
 * motion. */
export function scrollIntoViewGently(el: Element) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
}
