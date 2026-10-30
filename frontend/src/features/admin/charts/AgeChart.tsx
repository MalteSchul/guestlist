import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../../../api/client";
import { hatchStyle, Patterns, Tooltip } from "./ChartCard";
import { countTicks, linear } from "./scale";
import { useElementWidth } from "./useElementWidth";

type Band = Schemas["AgeBand"];

const HEIGHT = 236;
const GAP = 2; // surface between the two segments of a column
const MAX_THICKNESS = 24;
const RADIUS = 4;
const LABEL_EVERY = [1, 2, 5, 10, 20, 50]; // round, so the labels land on round ages

/** "30–39", "80+". */
export function ageLabel(band: Band, short = false): string {
  if (band.max_age === null) return `${band.min_age}+`;
  return short ? String(band.min_age) : `${band.min_age}–${band.max_age}`;
}

/** A column from `bottom` up to `top`, its top corners rounded when it ends the stack: the
 * baseline end stays square, as does the end that meets another segment. */
function column(x: number, top: number, bottom: number, width: number, round: boolean): string {
  const r = round ? Math.min(RADIUS, width / 2, bottom - top) : 0;
  const cap = r
    ? `Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}`
    : `H${x + width}`;
  return `M${x},${bottom}V${top + r}${cap}V${bottom}Z`;
}

/** The people coming (yes, and maybe on top), by age on the day of the event. */
export function AgeChart({ bands }: { bands: Band[] }) {
  const { t } = useTranslation();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<{ index: number; keyboard: boolean }>();

  const totals = bands.map((band) => band.yes + band.maybe);
  const yTicks = countTicks(Math.max(...totals));
  const margin = { top: 10, right: 12, bottom: 28, left: 30 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const y = linear([0, yTicks[yTicks.length - 1]!], [margin.top + plotH, margin.top]);
  const bandW = plotW / bands.length;
  const thickness = Math.min(MAX_THICKNESS, bandW * (bandW < 12 ? 0.8 : 0.6)); // fatter when crowded
  const centre = (i: number) => margin.left + bandW * (i + 0.5);
  // Narrow columns don't each get a label: every 2nd, 5th, 10th ... as many as fit, and always
  // the open one at the end.
  const shortLabels = bandW < 40;
  const labelWidth = Math.max(...bands.map((b) => ageLabel(b, shortLabels).length)) * 6.5 + 4;
  const every = LABEL_EVERY.find((n) => n * bandW >= labelWidth) ?? LABEL_EVERY[LABEL_EVERY.length - 1]!;
  const labelled = (i: number) =>
    i === bands.length - 1 || (i % every === 0 && bands.length - 1 - i >= every);

  // Touch has no pointer leaving: a tap elsewhere puts the readout away.
  useEffect(() => {
    if (!hover || hover.keyboard) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setHover(undefined);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [hover, ref]);

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") return setHover(undefined);
    const by = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (!by && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const last = bands.length - 1;
    const target = e.key === "Home" ? 0 : e.key === "End" ? last : (hover?.index ?? -1) + by!;
    setHover({ index: Math.min(Math.max(target, 0), last), keyboard: true });
  }

  const coming = totals.reduce((sum, n) => sum + n, 0);
  const band = hover && bands[hover.index];

  return (
    <div
      className="chart-plot"
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={t("admin.stats.agesSummary", { count: coming })}
      onKeyDown={onKey}
      onBlur={() => setHover(undefined)}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} style={hatchStyle(id) as CSSProperties} aria-hidden="true">
          <Patterns id={id} />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="grid" x1={margin.left} x2={margin.left + plotW} y1={y(tick)} y2={y(tick)} />
              <text x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {bands.map((b, i) => {
            const left = centre(i) - thickness / 2;
            const base = y(0);
            const yesTop = y(b.yes);
            const allTop = y(b.yes + b.maybe);
            // The gap only where both segments are tall enough to give some up.
            const gap = b.yes > 0 && b.maybe > 0 && yesTop - allTop > 3 * GAP ? GAP : 0;
            return (
              <g key={b.min_age} className={hover && hover.index !== i ? "dim" : undefined}>
                {b.yes > 0 && (
                  <path className="seg s-yes" d={column(left, yesTop, base, thickness, b.maybe === 0)} />
                )}
                {b.maybe > 0 && (
                  <path
                    className="seg s-maybe"
                    d={column(left, allTop, yesTop - gap, thickness, true)}
                  />
                )}
                {labelled(i) && (
                  <text className="x-label" x={centre(i)} y={base + 17} textAnchor="middle">
                    {ageLabel(b, shortLabels)}
                  </text>
                )}
              </g>
            );
          })}
          <line className="axis" x1={margin.left} x2={margin.left + plotW} y1={y(0)} y2={y(0)} />
          {bands.map((b, i) => (
            <rect
              key={b.min_age}
              className="hit"
              x={margin.left + bandW * i}
              y={margin.top - 6}
              width={bandW}
              height={plotH + 6}
              onPointerMove={(e: PointerEvent) => e.pointerType === "mouse" && setHover({ index: i, keyboard: false })}
              onPointerDown={() => setHover({ index: i, keyboard: false })}
              onPointerLeave={(e) => e.pointerType === "mouse" && setHover(undefined)}
            />
          ))}
        </svg>
      )}
      {hover && band && (
        <Tooltip
          x={centre(hover.index)}
          bounds={width}
          title={`${ageLabel(band)} ${t("admin.stats.years")}`}
          live={hover.keyboard}
          rows={[
            { key: "yes", value: band.yes },
            { key: "maybe", value: band.maybe },
          ]}
        />
      )}
    </div>
  );
}
