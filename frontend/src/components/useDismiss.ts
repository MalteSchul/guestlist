import { type RefObject, useEffect, useRef } from "react";

/** For something that opens over the page (a menu, a tooltip's bubble, a chart's readout):
 * while `active`, a press outside `ref` calls `close("press")`, and Escape `close("escape")`
 * unless `escape` is off. Touch has no pointer leaving, so the press is how it goes away there. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  close: (by: "press" | "escape") => void,
  { escape = true }: { escape?: boolean } = {},
) {
  // The latest `close`, without listening anew on every render.
  const latest = useRef(close);
  latest.current = close;

  useEffect(() => {
    if (!active) return;
    const press = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) latest.current("press");
    };
    const key = (e: KeyboardEvent) => {
      if (escape && e.key === "Escape") latest.current("escape");
    };
    document.addEventListener("pointerdown", press);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("keydown", key);
    };
  }, [active, escape, ref]);
}
