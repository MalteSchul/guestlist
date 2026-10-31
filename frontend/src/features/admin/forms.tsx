import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client";
import { Icon, type IconName } from "../../components/Icon";

/** Host-written text, in whatever language the host writes (D16). */
export function TextField({
  label,
  value,
  onChange,
  required = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  const props = {
    value,
    required,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <label className="field">
      <span>
        {label}
        {required && " *"}
      </span>
      {multiline ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
    </label>
  );
}

/** `datetime-local` inputs show the browser's time zone and carry no offset. */
export function localInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function isoOf(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** The state of a save, for the line next to its button. */
export function useSave() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();

  async function run(save: () => Promise<void>) {
    setStatus("saving");
    setError(undefined);
    try {
      await save();
      setStatus("saved");
    } catch (failure) {
      setStatus("idle");
      setError(failure instanceof ApiError && failure.message ? failure.message : t("common.error"));
    }
  }

  return {
    status,
    error,
    run,
    reset: () => setStatus("idle"),
    clearError: () => setError(undefined),
  };
}

export type Save = ReturnType<typeof useSave>;

/** The submit button, Cancel if given, and how the save went. `disabled` while there's nothing to
 * submit yet, e.g. no group chosen or nothing changed; `cancelDisabled` while there's nothing to
 * cancel. */
export function SaveBar({
  save,
  label,
  onCancel,
  disabled = false,
  cancelDisabled = false,
}: {
  save: Save;
  label?: string;
  onCancel?: () => void;
  disabled?: boolean;
  cancelDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="actions">
      <button type="submit" className="primary" disabled={disabled || save.status === "saving"}>
        {save.status === "saving" ? t("common.saving") : (label ?? t("common.save"))}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} disabled={cancelDisabled}>
          {t("common.cancel")}
        </button>
      )}
      {save.status === "saved" && <span className="success">{t("common.saved")}</span>}
      {save.error && <span className="error">{save.error}</span>}
    </div>
  );
}

/** Questions and options are ordered by `position`. */
type Positioned = { id: string; position: number };

/** New items go last. */
export function nextPosition(items: Positioned[]): number {
  return Math.max(-1, ...items.map((item) => item.position)) + 1;
}

/** Moves one item up or down and numbers the whole list afresh; returns the items whose
 * position changed, so only those are saved. */
export function moved<T extends Positioned>(items: T[], index: number, by: -1 | 1): T[] {
  const order = [...items];
  const [item] = order.splice(index, 1);
  order.splice(index + by, 0, item!);
  return order.flatMap((it, position) => (it.position === position ? [] : [{ ...it, position }]));
}

/** Move, edit and delete buttons for one item in an ordered list, as icons; `children` go
 * before edit, e.g. hiding an option. */
export function ItemControls({
  index,
  count,
  busy,
  onMove,
  onEdit,
  onDelete,
  children,
}: {
  index: number;
  count: number;
  busy: boolean;
  onMove: (by: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <span className="card-actions">
      <IconButton
        icon="up"
        label={t("admin.setup.up")}
        disabled={busy || index === 0}
        onClick={() => onMove(-1)}
      />
      <IconButton
        icon="down"
        label={t("admin.setup.down")}
        disabled={busy || index === count - 1}
        onClick={() => onMove(1)}
      />
      {children}
      <IconButton icon="edit" label={t("common.edit")} disabled={busy} onClick={onEdit} />
      <IconButton
        icon="delete"
        label={t("common.delete")}
        danger
        disabled={busy}
        onClick={onDelete}
      />
    </span>
  );
}

/** An action shown as its icon alone; the label is its tooltip and what screen readers say. */
export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  accent = false,
  expanded,
  pressed,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
  /** For a button that opens a menu: whether it is open. */
  expanded?: boolean;
  /** For a button that switches something on and off: whether it is on. */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={accent ? "icon accent" : danger ? "icon ghost danger" : "icon ghost"}
      aria-label={label}
      title={label}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
      aria-expanded={expanded}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
