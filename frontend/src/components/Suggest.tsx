import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { rank } from "./search";

export type SuggestItem = { id: string; label: string; detail?: string };

const SHOWN = 8;

/** An input with suggestions in a list under it while typing: at most a few, best matches
 * first (see `rank`), the first one highlighted, so Enter takes it. ↑/↓ move, Esc closes the list until the next keystroke.
 * Esc, keys the list doesn't use, and Enter without a suggestion go on to `onKeyDown`.
 * `emptyText` is shown when nothing matches; without it the list just stays closed, for
 * fields that also take free text. */
export function SuggestInput({
  value,
  onValueChange,
  items,
  onPick,
  emptyText,
  onKeyDown,
  inputRef,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onKeyDown"> & {
  value: string;
  onValueChange: (value: string) => void;
  items: SuggestItem[];
  onPick: (item: SuggestItem) => void;
  emptyText?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [closed, setClosed] = useState(false);
  // Best matches first; within a rank the items keep their order (sort is stable).
  const found = items
    .map((item) => ({ item, rank: rank(value, item.label, item.detail ?? "") }))
    .filter((hit) => hit.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((hit) => hit.item);
  const shown = found.slice(0, SHOWN);
  const open =
    focused && !closed && value.trim() !== "" && (shown.length > 0 || emptyText !== undefined);
  const current = open ? shown[Math.min(active, shown.length - 1)] : undefined;

  function pick(item: SuggestItem) {
    setActive(0);
    onPick(item);
  }

  function keyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (open && shown.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const by = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (Math.min(i, shown.length - 1) + by + shown.length) % shown.length);
    } else if (e.key === "Enter" && current) {
      e.preventDefault(); // takes the suggestion, never submits the form
      pick(current);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setClosed(true);
      onKeyDown?.(e); // e.g. a picker restoring what was picked before
    } else {
      onKeyDown?.(e);
    }
  }

  return (
    <div className="combobox">
      <input
        {...props}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        onChange={(e) => {
          setActive(0);
          setClosed(false);
          onValueChange(e.target.value);
        }}
        onKeyDown={keyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="options-list">
          {shown.map((item) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={item === current}
              className={item === current ? "active" : undefined}
              // mousedown, so the input keeps its focus
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActive(shown.indexOf(item))}
            >
              {item.label}
              {item.detail && <span className="muted"> · {item.detail}</span>}
            </li>
          ))}
          {found.length === 0 && <li className="muted empty">{emptyText}</li>}
          {found.length > SHOWN && (
            <li className="muted empty">
              {t("common.moreMatches", { count: found.length - SHOWN })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
