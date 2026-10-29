/** Maps a domain onto a range, linearly. */
export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (value: number) => r0 + (value - d0) * k;
}

const COUNT_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Round numbers from 0 up to at least `max`, about `target` of them: ticks for a count. */
export function countTicks(max: number, target = 4): number[] {
  const step = COUNT_STEPS.find((s) => max / s <= target) ?? 1000;
  const top = Math.max(1, Math.ceil(max / step)) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const TIME_STEPS = [
  10 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
];

/** Round moments in the viewer's time zone between `from` and `to`, about `target` of them:
 * on the hour, or on midnight when the step is a day or more. `step` says which. */
export function timeTicks(from: number, to: number, target = 5): { ticks: number[]; step: number } {
  const step = TIME_STEPS.find((s) => (to - from) / s <= target) ?? 90 * DAY;
  const ticks: number[] = [];
  if (step < DAY) {
    const offset = new Date(from).getTimezoneOffset() * MINUTE; // local time = UTC - offset
    for (let t = Math.ceil((from - offset) / step) * step + offset; t <= to; t += step) {
      ticks.push(t);
    }
  } else {
    const days = Math.round(step / DAY);
    const day = new Date(from);
    day.setHours(0, 0, 0, 0);
    if (day.getTime() < from) day.setDate(day.getDate() + 1);
    for (; day.getTime() <= to; day.setDate(day.getDate() + days)) ticks.push(day.getTime());
  }
  return { ticks, step };
}
