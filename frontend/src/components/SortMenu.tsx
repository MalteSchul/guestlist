import { useEffect, useRef, useState } from "react";

import { IconButton } from "../features/admin/forms";
import { Icon, type IconName } from "./Icon";
import { useDismiss } from "./useDismiss";

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
}: {
  label: string;
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The icon that opens the list; the sort icon unless this chooses something else. */
  icon?: IconName;
  /** Shown like a filter that is on, for a choice other than the usual one. */
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const current = options.find((option) => option.value === value)!;

  // Opened: the cursor on the choice in use. Closed with Escape: back on the icon.
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);
  useDismiss(ref, open, (by) => {
    setOpen(false);
    if (by === "escape") ref.current?.querySelector<HTMLElement>("button")?.focus();
  });

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
        </div>
      )}
    </span>
  );
}
