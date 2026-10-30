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
import { hatchStyle, Patterns, type Series, SERIES, Tooltip, without } from "./ChartCard";
import { countTicks, DAY, HOUR, linear, timeTicks } from "./scale";
import { useElementWidth } from "./useElementWidth";

type Step = Schemas["AttendanceStep"];

const HEIGHT = 236;
const LABEL_GAP = 14; // least space between two direct labels

/** How the answers came in: people by answer, stacked, from the first invitation until `end`.
 * A step chart, because the numbers only change when someone is invited or answers. */
export function AttendanceTimeline({
  steps: all,
  end,
  hidden,
}: {
  steps: Step[];
  end: number;
  hidden: ReadonlySet<Series>;
}) {
  const { t, i18n } = useTranslation();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  // Where the reader points (or, with the keyboard, which step), and what that step is.
  const [cursor, setCursor] = useState<{ x: number; index: number; keyboard: boolean }>();

  const steps = all.map((step) => without(step, hidden));
  const times = steps.map((step) => new Date(step.at).getTime());
  const from = times[0]!;
  const to = Math.max(end, from + HOUR);
  const yTicks = countTicks(Math.max(...steps.map((s) => s.yes + s.maybe + s.no + s.pending)));
  const wide = width >= 520; // room for the direct labels
  const { ticks, step: tickStep } = timeTicks(from, to, wide ? 5 : 3);
  // Under a day the ticks are times, with the date on a second line.
  const margin = { top: 10, right: wide ? 116 : 12, bottom: tickStep < DAY ? 42 : 28, left: 30 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const x = linear([from, to], [margin.left, margin.left + plotW]);
  const y = linear([0, yTicks[yTicks.length - 1]!], [margin.top + plotH, margin.top]);
  const xs = times.map(x);
  const xEnd = x(to);
  // levels[k][i] is where series i starts at step k, levels[k][i + 1] where it ends.
  const levels = steps.map((step) => {
    let sum = 0;
    return [0, ...SERIES.map((key) => (sum += step[key]))];
  });
  const last = steps.length - 1;

  const lang = i18n.language;
  const clock = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" });
  const dateYear = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "2-digit" });
  const full = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  const manyYears = new Date(from).getFullYear() !== new Date(to).getFullYear();

  // Touch has no pointer leaving: a tap elsewhere puts the readout away.
  useEffect(() => {
    if (!cursor || cursor.keyboard) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setCursor(undefined);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [cursor, ref]);

  /** The closed outline of a series, stepping along its top and back along its bottom. */
  function area(i: number): string {
    let d = `M${xs[0]},${y(levels[0]![i + 1]!)}`;
    for (let k = 1; k <= last; k++) d += `H${xs[k]}V${y(levels[k]![i + 1]!)}`;
    d += `H${xEnd}V${y(levels[last]![i]!)}`;
    for (let k = last; k >= 1; k--) d += `H${xs[k]}V${y(levels[k - 1]![i]!)}`;
    return `${d}H${xs[0]}Z`;
  }

  /** Its top edge where it has any people: a series that is empty has no line to hide the
   * one of the series below it. */
  function edge(i: number): string {
    let d = "";
    for (let k = 0; k <= last; k++) {
      const [lower, upper] = [levels[k]![i]!, levels[k]![i + 1]!];
      if (upper <= lower) continue;
      const before = k > 0 && levels[k - 1]![i + 1]! > levels[k - 1]![i]!;
      const right = k < last ? xs[k + 1]! : xEnd;
      d += before ? `V${y(upper)}H${right}` : `M${xs[k]},${y(upper)}H${right}`;
    }
    return d;
  }

  // Direct labels at the right end, from the bottom up, leaving out any that would touch.
  const labels: { i: number; y: number }[] = [];
  let lastY = Infinity;
  for (let i = 0; i < SERIES.length; i++) {
    const [lower, upper] = [levels[last]![i]!, levels[last]![i + 1]!];
    const at = y((lower + upper) / 2);
    if (wide && upper > lower && lastY - at >= LABEL_GAP) {
      labels.push({ i, y: at });
      lastY = at;
    }
  }

  function point(e: PointerEvent<SVGRectElement>) {
    const left = e.currentTarget.getBoundingClientRect().left;
    const px = Math.min(Math.max(e.clientX - left + margin.left, xs[0]!), xEnd);
    // The step in force at that moment: the last one that has begun.
    const index = xs.reduce((found, stepX, k) => (stepX <= px ? k : found), -1);
    setCursor({ x: px, index, keyboard: false });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") return setCursor(undefined);
    const by = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (!by && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const target = e.key === "Home" ? 0 : e.key === "End" ? last : (cursor?.index ?? -1) + by!;
    const index = Math.min(Math.max(target, 0), last);
    setCursor({ x: xs[index]!, index, keyboard: true });
  }

  const now = steps[last]!;
  const shown = cursor && cursor.index >= 0 ? cursor : undefined;
  const shownTime = shown
    ? shown.keyboard
      ? times[shown.index]!
      : from + ((shown.x - margin.left) / (plotW || 1)) * (to - from)
    : 0;

  return (
    <div
      className="chart-plot"
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={t("admin.stats.timelineSummary", {
        yes: all[last]!.yes,
        maybe: all[last]!.maybe,
        no: all[last]!.no,
        pending: all[last]!.pending,
      })}
      onKeyDown={onKey}
      onBlur={() => setCursor(undefined)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          style={hatchStyle(id) as CSSProperties}
          aria-hidden="true"
        >
          <Patterns id={id} />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="grid" x1={margin.left} x2={margin.left + plotW} y1={y(tick)} y2={y(tick)} />
              <text x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {SERIES.map((key, i) => (
            <path key={key} className={`area s-${key}`} d={area(i)} />
          ))}
          {SERIES.map((key, i) => (
            <path key={key} className={`edge s-${key}`} d={edge(i)} />
          ))}
          <line className="axis" x1={margin.left} x2={margin.left + plotW} y1={y(0)} y2={y(0)} />
          {ticks.map((tick, n) => {
            const tx = x(tick);
            const anchor =
              tx < margin.left + 14 ? "start" : tx > margin.left + plotW - 14 ? "end" : "middle";
            const newDay = n === 0 || new Date(tick).getDate() !== new Date(ticks[n - 1]!).getDate();
            return (
              <text key={tick} x={tx} y={y(0) + 16} textAnchor={anchor}>
                {tickStep < DAY ? clock.format(tick) : (manyYears ? dateYear : date).format(tick)}
                {tickStep < DAY && newDay && (
                  <tspan x={tx} dy="1.25em">
                    {date.format(tick)}
                  </tspan>
                )}
              </text>
            );
          })}
          {labels.map(({ i, y: at }) => {
            const key = SERIES[i]!;
            return (
              <g key={key} className={`s-${key}`}>
                <line className="tip-line" x1={xEnd + 6} x2={xEnd + 16} y1={at} y2={at} />
                <text className="direct" x={xEnd + 21} y={at} dy="0.32em">
                  {now[key]} {t(`admin.attendance.${key}`)}
                </text>
              </g>
            );
          })}
          {shown && (
            <g>
              <line className="crosshair" x1={shown.x} x2={shown.x} y1={margin.top} y2={y(0)} />
              {SERIES.map((key, i) => {
                const [lower, upper] = [levels[shown.index]![i]!, levels[shown.index]![i + 1]!];
                return upper > lower ? (
                  <circle key={key} className={`dot s-${key}`} cx={shown.x} cy={y(upper)} r={4} />
                ) : null;
              })}
            </g>
          )}
          <rect
            className="hit"
            x={margin.left}
            y={margin.top}
            width={plotW}
            height={plotH}
            onPointerMove={point}
            onPointerDown={point}
            onPointerLeave={(e) => e.pointerType === "mouse" && setCursor(undefined)}
          />
        </svg>
      )}
      {shown && (
        <Tooltip
          x={shown.x}
          bounds={width}
          title={full.format(shownTime)}
          live={shown.keyboard}
          rows={SERIES.filter((key) => !hidden.has(key)).map((key) => ({
            key,
            value: steps[shown.index]![key],
          }))}
        />
      )}
    </div>
  );
}
