import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { IconButton } from "../features/admin/forms";

/** The sort icon, and next to it the choice of order. One entry is chosen; picking another
 * closes the list. */
export function SortMenu<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <span className="menu-wrap" ref={ref}>
      <IconButton icon="sort" label={label} expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <div className="menu" role="menu" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="menu-check" aria-hidden="true">
                {option.value === value && <Icon name="check" />}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
