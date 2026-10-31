import { useTranslation } from "react-i18next";

import type { Schemas } from "../api/client";
import { AttendanceIcon } from "./AttendanceIcon";

export const ATTENDANCE = ["yes", "maybe", "no", "pending"] as const;

/** "1 ✓  3 ?  2 ✕  1 ◷": how many people gave which answer, e.g. under an event's name in the
 * list; the answer's name is the tooltip. */
export function AttendanceCounts({ counts }: { counts: Schemas["AttendanceCounts"] }) {
  const { t } = useTranslation();
  return (
    <ul className="stats" aria-label={t("admin.event.personsTally")}>
      {ATTENDANCE.map((attendance) => {
        const label = `${t(`admin.attendance.${attendance}`)}: ${counts[attendance]}`;
        return (
          <li key={attendance} title={label} aria-label={label}>
            {counts[attendance]}
            <AttendanceIcon attendance={attendance} />
          </li>
        );
      })}
    </ul>
  );
}
