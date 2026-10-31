import { useEffect, useRef, useState } from "react";

import { IconButton } from "../features/admin/forms";
import { Icon, type IconName } from "./Icon";

/** A switch below the choices, e.g. "only those who answered". It can be turned on and off
 * without the list closing, so the choice above stays in view. */
export type MenuSwitch = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

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
  icon = "sort",
  active = false,
  extra,
}: {
  label: string;
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The icon that opens the list; the sort icon unless this chooses something else. */
  icon?: IconName;
  /** Shown like a filter that is on, for a choice other than the usual one. */
  active?: boolean;
  extra?: MenuSwitch;
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
    <span className={active ? "menu-wrap wide active" : "menu-wrap wide"} ref={ref}>
      <IconButton
        icon={icon}
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
          {extra && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={extra.checked}
              aria-disabled={extra.disabled || undefined}
              className="group-start"
              onClick={() => !extra.disabled && extra.onChange(!extra.checked)}
            >
              <span className="menu-check" aria-hidden="true">
                {extra.checked && <Icon name="check" />}
              </span>
              {extra.label}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
