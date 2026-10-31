import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { ATTENDANCE } from "../../components/AttendanceCounts";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { sortedByName } from "../../i18n/text";

/** Who gave which answer, under the counts: one line per answer with everyone's name, A to Z.
 * The host's view, so everyone is listed, not only those who agreed to the guest list. */
export function AttendanceNames({ persons }: { persons: Schemas["HostPersonOut"][] }) {
  const { t, i18n } = useTranslation();
  const rows = ATTENDANCE.map((attendance) => ({
    attendance,
    names: sortedByName(
      persons.filter((person) => person.attendance === attendance),
      i18n.language,
    ).map((person) => person.name),
  })).filter((row) => row.names.length > 0);
  if (rows.length === 0) return null;

  return (
    <div className="card">
      <ul className="persons">
        {rows.map(({ attendance, names }) => {
          const label = t(`admin.attendance.${attendance}`);
          return (
            <li key={attendance}>
              <span className="status" role="img" aria-label={label} title={label}>
                <AttendanceIcon attendance={attendance} />
              </span>
              <span>{names.join(", ")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
