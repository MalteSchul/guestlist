import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { ATTENDANCE } from "../../components/AttendanceCounts";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { sortedByName } from "../../i18n/text";

/** Who gave which answer: one line per answer with how many and everyone's name, A to Z. All
 * four lines always show, so the numbers can be read at a glance. The host's view, so everyone
 * is listed, not only those who agreed to the guest list. */
export function AttendanceNames({ persons }: { persons: Schemas["HostPersonOut"][] }) {
  const { t, i18n } = useTranslation();
  const rows = ATTENDANCE.map((attendance) => ({
    attendance,
    names: sortedByName(
      persons.filter((person) => person.attendance === attendance),
      i18n.language,
    ).map((person) => person.name),
  }));

  return (
    <div className="card">
      <ul className="persons">
        {rows.map(({ attendance, names }) => {
          const label = `${t(`admin.attendance.${attendance}`)}: ${names.length}`;
          return (
            <li key={attendance}>
              <span className="status" role="img" aria-label={label} title={label}>
                <AttendanceIcon attendance={attendance} />
              </span>
              <strong className="count" aria-hidden="true">
                {names.length}
              </strong>
              <span>{names.join(", ")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
