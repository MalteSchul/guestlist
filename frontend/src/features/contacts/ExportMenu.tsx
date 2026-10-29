import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "../admin/forms";
import { download, toCsv, toJson } from "./exportFile";

type Contact = Parameters<typeof toCsv>[0][number];
type Group = Parameters<typeof toCsv>[1][number];

/** The export icon, and under it the choice of file: a spreadsheet (CSV) or a backup (JSON). */
export function ExportMenu({ contacts, groups }: { contacts: Contact[]; groups: Group[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

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
        label={t("contacts.export.label")}
        disabled={contacts.length === 0}
        expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="menu" role="menu">
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
