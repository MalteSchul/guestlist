import { Icon } from "./Icon";

/** A search box marked by a magnifier instead of a placeholder; `label` names it for screen
 * readers. */
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
