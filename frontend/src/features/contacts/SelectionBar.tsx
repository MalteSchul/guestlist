import { useTranslation } from "react-i18next";

import { IconButton } from "../admin/forms";
import { ExportMenu } from "./ExportMenu";

type Export = Parameters<typeof ExportMenu>[0];

/** The select mode's bar, at the bottom of the window so it stays in reach while the lists
 * scroll: the way out, how many are ticked, and what to do with them. `contacts` and `groups`
 * are what the export would write (see exportSelection). */
export function SelectionBar({
  count,
  contacts,
  groups,
  busy,
  error,
  onDone,
  onDelete,
}: {
  count: number;
  contacts: Export["contacts"];
  groups: Export["groups"];
  busy: boolean;
  error?: string;
  onDone: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="selection-bar" role="region" aria-label={t("contacts.selection.label")}>
      <IconButton icon="close" label={t("contacts.selection.done")} onClick={onDone} />
      <span className={count > 0 ? "selection-count" : "selection-count muted"} aria-live="polite">
        {count > 0 ? t("contacts.selection.count", { count }) : t("contacts.selection.none")}
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
        disabled={busy || count === 0}
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
