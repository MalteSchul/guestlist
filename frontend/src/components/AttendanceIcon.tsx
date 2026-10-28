import type { Schemas } from "../api/client";

type Attendance = Schemas["PersonOut"]["attendance"];

/** A small line icon per answer: check, question mark, cross, clock. Decorative, the label says it. */
export function AttendanceIcon({ attendance }: { attendance: Attendance }) {
  return (
    <svg className="attendance-icon" viewBox="0 0 24 24" aria-hidden="true">
      {attendance === "yes" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
      {attendance === "maybe" && (
        <path d="M9 9a3 3 0 1 1 4.2 2.75c-.75.35-1.2 1.1-1.2 1.95V14.5M12 18.5h.01" />
      )}
      {attendance === "no" && <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />}
      {attendance === "pending" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )}
    </svg>
  );
}
