import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { useDismiss } from "./useDismiss";

/** A "?" that shows a short explanation in a bubble: on hover with a mouse, on tap on a phone,
 * on Enter or Space with the keyboard. Tapping elsewhere, Esc or leaving it closes it again.
 * `children` go under the text in the bubble, e.g. a key to icons. */
export function InfoTip({ text, children }: { text: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // The bubble starts under the "?"; near the window's right edge it moves left to stay inside.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const over = el.getBoundingClientRect().right - (document.documentElement.clientWidth - 16);
    el.style.transform = over > 0 ? `translateX(${-over}px)` : "";
  }, [open]);

  useDismiss(ref, open, () => setOpen(false));

  return (
    <span
      className="info-tip"
      ref={ref}
      // Only a real mouse: a tap sends pointer events too, and would open and close it at once.
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        className="icon ghost"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon name="help" />
      </button>
      {open && (
        <span className="bubble" role="tooltip" ref={bubble}>
          {text}
          {children}
        </span>
      )}
    </span>
  );
}
