import { useEffect, useRef, useState } from "react";

import { IconButton } from "../features/admin/forms";
import { Icon } from "./Icon";

export type Direction = "asc" | "desc";
export type Sorting<T extends string> = { key: T; direction: Direction };

export type SortOption<T extends string> = {
  key: T;
  label: string;
  /** What each direction means for this key, e.g. "A–Z" and "Z–A". */
  directions: Record<Direction, string>;
  /** The direction a key starts with when it is picked. */
  first: Direction;
};

/** The sort icon, and next to it a list of what to sort by. Each row says which way it would
 * go; the one in use has an arrow for its direction. Picking it again turns it around, picking
 * another one starts that one in its usual direction. */
export function SortMenu<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SortOption<T>[];
  value: Sorting<T>;
  onChange: (value: Sorting<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const current = options.find((option) => option.key === value.key)!;

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

  function pick(option: SortOption<T>) {
    const same = option.key === value.key;
    onChange({
      key: option.key,
      direction: same ? (value.direction === "asc" ? "desc" : "asc") : option.first,
    });
    setOpen(false);
  }

  return (
    <span className="menu-wrap wide" ref={ref}>
      <IconButton
        icon="sort"
        label={`${label}: ${current.label}, ${current.directions[value.direction]}`}
        expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="menu" role="menu" aria-label={label}>
          {options.map((option) => {
            const active = option.key === value.key;
            const direction = active ? value.direction : option.first;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => pick(option)}
              >
                <span className="menu-check" aria-hidden="true">
                  {active && <Icon name={value.direction === "asc" ? "up" : "down"} />}
                </span>
                <span className="menu-label">{option.label}</span>
                <span className="muted">{option.directions[direction]}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
