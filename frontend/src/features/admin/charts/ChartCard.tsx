import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { InfoTip } from "../../../components/InfoTip";
import { IconButton } from "../forms";

/** The answers, in the order they are stacked and listed. Each has its colour in styles.css. */
export const SERIES = ["yes", "maybe", "no", "pending"] as const;
export type Series = (typeof SERIES)[number];

/** A chart in a card: its name, the legend, and the same numbers as a table (the button next
 * to the name switches), for whoever can't read them off the drawing. */
export function ChartCard({
  title,
  hint,
  legend,
  table,
  note,
  children,
}: {
  title: string;
  hint?: string;
  legend: ReactNode;
  table: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
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
        <IconButton
          icon="table"
          label={t("admin.stats.table")}
          pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        />
      </figcaption>
      {legend}
      {asTable ? table : children}
      {note && !asTable && <p className="chart-note muted">{note}</p>}
    </figure>
  );
}

/** What each colour means; the swatch is the mark, the words stay in the text colour. */
export function Legend({ items }: { items: readonly Series[] }) {
  const { t } = useTranslation();
  return (
    <ul className="legend">
      {items.map((key) => (
        <li key={key} className={`s-${key}`}>
          <span className="swatch" aria-hidden="true" />
          {t(`admin.attendance.${key}`)}
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
