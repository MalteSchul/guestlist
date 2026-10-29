import { useTranslation } from "react-i18next";

import { IconButton } from "../admin/forms";
import { ExportMenu } from "./ExportMenu";

type Export = Parameters<typeof ExportMenu>[0];

/** What was ticked in the address book, at the bottom of the window so it stays in reach while
 * the lists scroll: how many, and what to do with them. `contacts` and `groups` are what the
 * export would write (see exportSelection). */
export function SelectionBar({
  count,
  contacts,
  groups,
  busy,
  error,
  onClear,
  onDelete,
}: {
  count: number;
  contacts: Export["contacts"];
  groups: Export["groups"];
  busy: boolean;
  error?: string;
  onClear: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="selection-bar" role="region" aria-label={t("contacts.selection.label")}>
      <IconButton icon="close" label={t("contacts.selection.clear")} onClick={onClear} />
      <span className="selection-count" aria-live="polite">
        {t("contacts.selection.count", { count })}
      </span>
      <ExportMenu
        contacts={contacts}
        groups={groups}
        label={t("contacts.selection.export")}
        up
      />
      <IconButton
        icon="delete"
        label={t("contacts.selection.delete")}
        danger
        disabled={busy}
        onClick={onDelete}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
