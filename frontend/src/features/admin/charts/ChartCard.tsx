import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { InfoTip } from "../../../components/InfoTip";
import { IconButton } from "../forms";

/** The answers, in the order they are stacked and listed. Each has its colour in styles.css. */
export const SERIES = ["yes", "maybe", "no", "pending"] as const;
export type Series = (typeof SERIES)[number];

/** Which answers the reader has switched off in a chart's legend. One always stays on. */
export function useSeriesToggle() {
  const [hidden, setHidden] = useState<ReadonlySet<Series>>(new Set());
  function toggle(key: Series) {
    setHidden((before) => {
      const next = new Set(before);
      if (next.has(key)) next.delete(key);
      else if (SERIES.length - next.size > 1) next.add(key);
      return next;
    });
  }
  return [hidden, toggle] as const;
}

/** The row with the switched-off answers counted as nobody: the chart then stacks, scales and
 * labels only what is left. */
export function without<T extends Record<Series, number>>(row: T, hidden: ReadonlySet<Series>): T {
  return hidden.size === 0
    ? row
    : { ...row, ...Object.fromEntries([...hidden].map((key) => [key, 0])) };
}

/** A chart in a card: its name, the legend, and the same numbers as a table (the button next
 * to the name switches), for whoever can't read them off the drawing. */
export function ChartCard({
  title,
  hint,
  options,
  legend,
  table,
  note,
  children,
}: {
  title: string;
  hint?: string;
  /** Controls that change what the chart shows; a button next to the table's opens them. */
  options?: { label: string; controls: ReactNode };
  legend: ReactNode;
  table: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  return (
    <figure className="card chart">
      <figcaption className="chart-head">
        <span>
          <strong>{title}</strong>
          {hint && (
            <>
              {" "}
              <InfoTip text={hint} />
            </>
          )}
        </span>
        <span className="heading-actions">
          {options && (
            <IconButton
              icon="sliders"
              label={options.label}
              pressed={adjusting}
              onClick={() => setAdjusting(!adjusting)}
            />
          )}
          <IconButton
            icon="table"
            label={t("admin.stats.table")}
            pressed={asTable}
            onClick={() => setAsTable(!asTable)}
          />
        </span>
      </figcaption>
      {options && adjusting && <div className="chart-options">{options.controls}</div>}
      {legend}
      {asTable ? table : children}
      {note && !asTable && <p className="chart-note muted">{note}</p>}
    </figure>
  );
}

/** What each colour means; the swatch is the mark, the words stay in the text colour. Each
 * entry is a switch: pressed it shows that answer in the chart, released it leaves it out. */
export function Legend({
  items,
  hidden,
  onToggle,
}: {
  items: readonly Series[];
  hidden: ReadonlySet<Series>;
  onToggle: (key: Series) => void;
}) {
  const { t } = useTranslation();
  const last = items.length - hidden.size === 1; // the one left can't be switched off
  return (
    <ul className="legend">
      {items.map((key) => (
        <li key={key} className={`s-${key}`}>
          <button
            type="button"
            aria-pressed={!hidden.has(key)}
            aria-disabled={last && !hidden.has(key) ? true : undefined}
            onClick={() => onToggle(key)}
          >
            <span className="swatch" aria-hidden="true" />
            {t(`admin.attendance.${key}`)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export type TipRow = { key: Series; value: number };

/** The readout at the pointer: one line per series, the number first. It sits beside the
 * pointer, on whichever side has room inside `bounds`. */
export function Tooltip({
  x,
  bounds,
  title,
  rows,
  live = false,
}: {
  x: number;
  bounds: number;
  title: string;
  rows: TipRow[];
  /** Said aloud as it changes, for a reader moving with the keyboard. */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => setSize(ref.current?.offsetWidth ?? 0), [title, rows.length]);
  const left = x + 14 + size > bounds ? Math.max(0, x - 14 - size) : x + 14;
  return (
    <div className="chart-tip" ref={ref} style={{ left }} aria-live={live ? "polite" : undefined}>
      <div className="muted">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className={`tip-row s-${row.key}`}>
          <span className="tip-key" aria-hidden="true" />
          <strong>{row.value}</strong>
          <span className="muted">{t(`admin.attendance.${row.key}`)}</span>
        </div>
      ))}
    </div>
  );
}

/** Fills of lines at 45° and 135° for print and high-contrast screens, where the colours may
 * not survive. Only those two media use them (styles.css); `id` keeps charts apart. */
export function Patterns({ id }: { id: string }) {
  return (
    <defs>
      {SERIES.map((key, i) => (
        <pattern
          key={key}
          id={`${id}-${key}`}
          className={`s-${key}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${i % 2 === 0 ? 45 : 135})`}
        >
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth={i < 2 ? 2.5 : 1.25} />
        </pattern>
      ))}
    </defs>
  );
}

/** The `--hatch-*` variables that point the series' marks at their patterns. */
export function hatchStyle(id: string): Record<string, string> {
  return Object.fromEntries(SERIES.map((key) => [`--hatch-${key}`, `url(#${id}-${key})`]));
}
