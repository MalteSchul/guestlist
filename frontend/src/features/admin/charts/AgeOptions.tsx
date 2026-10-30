import { useTranslation } from "react-i18next";

export type Grouping = { step: number; from: number };

/** Ten-year groups, everyone from 80 on together. */
export const DEFAULT_GROUPING: Grouping = { step: 10, from: 80 };

const STEPS = [1, 2, 5, 10, 20];
const FROM = [18, 20, 30, 40, 50, 60, 65, 70, 80, 90, 100];
const MAX_GROUPS = 30; // what the API takes; more would not fit the chart

/** How many columns a grouping makes: the closed groups and the one for everyone older. */
const groups = ({ step, from }: Grouping) => Math.ceil(from / step) + 1;
const fits = (grouping: Grouping) => groups(grouping) <= MAX_GROUPS;

/** A new group size; the age the last group starts at moves down if the old one no longer fits. */
function withStep(grouping: Grouping, step: number): Grouping {
  if (fits({ ...grouping, step })) return { ...grouping, step };
  const from =
    [...FROM].reverse().find((f) => fits({ step, from: f })) ?? FROM[0]!;
  return { step, from };
}

/** A new age for the last group; the group size grows if the old one would make too many. */
function withFrom(grouping: Grouping, from: number): Grouping {
  if (fits({ ...grouping, from })) return { ...grouping, from };
  const step =
    STEPS.find((s) => fits({ step: s, from })) ?? STEPS[STEPS.length - 1]!;
  return { step, from };
}

/** The two choices that shape the age chart: the size of a group and the age from which
 * everyone counts together. Every choice can be made: when it would make too many groups, the
 * other one gives way (a smaller age to start the last group, or bigger groups). */
export function AgeOptions({
  grouping,
  onChange,
}: {
  grouping: Grouping;
  onChange: (grouping: Grouping) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label>
        {t("admin.stats.groupSize")}
        <select
          value={grouping.step}
          onChange={(e) => onChange(withStep(grouping, Number(e.target.value)))}
        >
          {STEPS.map((step) => (
            <option key={step} value={step}>
              {t("admin.stats.groupYears", { count: step })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("admin.stats.groupFrom")}
        <select
          value={grouping.from}
          onChange={(e) => onChange(withFrom(grouping, Number(e.target.value)))}
        >
          {FROM.map((from) => (
            <option key={from} value={from}>
              {from}+
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
