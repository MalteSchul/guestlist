/** A checkbox with the same hit area as an icon button, so it lines up with the icons beside it.
 * `indeterminate` is the dash of a "select all" box while only some are ticked. */
export function SelectBox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="select-box" title={label}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
