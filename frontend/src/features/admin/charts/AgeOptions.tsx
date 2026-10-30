import { useTranslation } from "react-i18next";

export type Grouping = { step: number; from: number };

/** Ten-year groups, everyone from 80 on together. */
export const DEFAULT_GROUPING: Grouping = { step: 10, from: 80 };

const STEPS = [1, 2, 5, 10, 20];
const FROM = [18, 20, 30, 40, 50, 60, 65, 70, 80, 90, 100];
const MAX_GROUPS = 30; // what the API takes; more would not fit the chart

/** How many columns a grouping makes: the closed groups and the one for everyone older. */
const groups = ({ step, from }: Grouping) => Math.ceil(from / step) + 1;

/** The two choices that shape the age chart: the size of a group and the age from which
 * everyone counts together. A choice that would make too many groups is not offered. */
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
          onChange={(e) => onChange({ ...grouping, step: Number(e.target.value) })}
        >
          {STEPS.map((step) => (
            <option key={step} value={step} disabled={groups({ ...grouping, step }) > MAX_GROUPS}>
              {t("admin.stats.groupYears", { count: step })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("admin.stats.groupFrom")}
        <select
          value={grouping.from}
          onChange={(e) => onChange({ ...grouping, from: Number(e.target.value) })}
        >
          {FROM.map((from) => (
            <option key={from} value={from} disabled={groups({ ...grouping, from }) > MAX_GROUPS}>
              {from}+
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
