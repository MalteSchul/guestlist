import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { type SuggestItem, SuggestInput } from "./Suggest";

export type PickerItem = SuggestItem;

/** Pick from a list too long to show: matches only while typing (SuggestInput). Several picks
 * show as chips (Backspace on an empty search removes the last one); a `single` pick shows in
 * the field itself, like an autocomplete, and leaving it without picking keeps the old one. */
export function Picker({
  label,
  placeholder,
  items,
  selected,
  onChange,
  single = false,
}: {
  label: string;
  placeholder: string;
  items: PickerItem[];
  /** IDs in the order they were picked. */
  selected: string[];
  onChange: (selected: string[]) => void;
  single?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false); // single: the field shows the query, not the pick
  const byId = new Map(items.map((item) => [item.id, item]));
  // A single pick shown in the field isn't a search: no list until the field is typed in.
  const searching = !single || typing;

  function pick(item: PickerItem) {
    onChange(single ? [item.id] : [...selected, item.id]);
    setQuery("");
    setTyping(false);
  }

  function keyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // never submits the form, even without a match
    } else if (e.key === "Escape" && typing) {
      e.preventDefault();
      setQuery("");
      setTyping(false);
    } else if (e.key === "Backspace" && !single && !query && selected.length) {
      onChange(selected.slice(0, -1));
    }
  }

  return (
    <div className="field">
      <span>
        {label}
        {!single && ` (${selected.length})`}
      </span>
      {!single && selected.length > 0 && (
        <ul className="chips">
          {selected.map((id) => (
            <li key={id} className="chip">
              {byId.get(id)?.label}
              <button
                type="button"
                aria-label={t("common.removeItem", { name: byId.get(id)?.label })}
                onClick={() => onChange(selected.filter((s) => s !== id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <SuggestInput
        aria-label={label}
        placeholder={placeholder}
        value={single && !typing ? (byId.get(selected[0] ?? "")?.label ?? "") : query}
        onValueChange={(value) => {
          setQuery(value);
          setTyping(true);
        }}
        items={searching ? items.filter((item) => !selected.includes(item.id)) : []}
        onPick={pick}
        emptyText={searching ? t("common.noMatch") : undefined}
        onKeyDown={keyDown}
        onFocus={(e) => single && e.target.select()}
        onBlur={() => {
          setQuery("");
          setTyping(false);
        }}
      />
    </div>
  );
}
