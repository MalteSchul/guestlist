import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDismiss } from "../../components/useDismiss";
import { IconButton } from "../admin/forms";
import { download, toCsv, toJson } from "./exportFile";

type Contact = Parameters<typeof toCsv>[0][number];
type Group = Parameters<typeof toCsv>[1][number];

/** The export icon, and next to it the choice of file: a spreadsheet (CSV) or a backup (JSON).
 * `up` opens the choice above the icon, for one at the bottom of the window. */
export function ExportMenu({
  contacts,
  groups,
  label,
  up = false,
}: {
  contacts: Contact[];
  groups: Group[];
  label?: string;
  up?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Opened: the cursor on the first choice. Closed with Escape: back on the icon.
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  useDismiss(ref, open, (by) => {
    setOpen(false);
    if (by === "escape") ref.current?.querySelector<HTMLElement>("button")?.focus();
  });

  function save(kind: "csv" | "json") {
    setOpen(false);
    if (kind === "csv") {
      download("guestlist-contacts.csv", toCsv(contacts, groups), "text/csv;charset=utf-8");
    } else {
      download("guestlist-contacts.json", toJson(contacts, groups), "application/json");
    }
  }

  return (
    <span className="menu-wrap" ref={ref}>
      <IconButton
        icon="export"
        label={label ?? t("contacts.export.label")}
        disabled={contacts.length === 0 && groups.length === 0}
        expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className={up ? "menu up" : "menu"} role="menu">
          {(["csv", "json"] as const).map((kind) => (
            <button key={kind} type="button" role="menuitem" onClick={() => save(kind)}>
              <strong>{kind.toUpperCase()}</strong>
              <span className="muted">{t(`contacts.export.${kind}`)}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
