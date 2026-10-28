import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";

/** A "?" that shows a short explanation in a bubble: on hover with a mouse, on tap on a phone,
 * on Enter or Space with the keyboard. Tapping elsewhere, Esc or leaving it closes it again. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

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
        <span className="bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
