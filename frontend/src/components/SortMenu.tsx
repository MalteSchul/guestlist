import { useEffect, useRef, useState } from "react";

import { IconButton } from "../features/admin/forms";
import { Icon } from "./Icon";

export type SortOption<T extends string> = {
  value: T;
  label: string;
  /** Options with the same group (one thing, either way) sit together, with a line between groups. */
  group: string;
};

/** The sort icon, and next to it every order to choose from, each way of each kind of sorting
 * as its own entry. The one in use has a check; picking another closes the list. */
export function SortMenu<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const current = options.find((option) => option.value === value)!;

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
    <span className="menu-wrap wide" ref={ref}>
      <IconButton
        icon="sort"
        label={`${label}: ${current.label}`}
        expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="menu" role="menu" aria-label={label}>
          {options.map((option, i) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={i > 0 && options[i - 1]!.group !== option.group ? "group-start" : undefined}
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
