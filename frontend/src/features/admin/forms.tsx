import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client";

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

  return { status, error, run, reset: () => setStatus("idle") };
}

export type Save = ReturnType<typeof useSave>;

export function SaveBar({
  save,
  label,
  onCancel,
}: {
  save: Save;
  label?: string;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="actions">
      <button type="submit" className="primary" disabled={save.status === "saving"}>
        {save.status === "saving" ? t("common.saving") : (label ?? t("common.save"))}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      )}
      {save.status === "saved" && <span className="success">{t("common.saved")}</span>}
      {save.error && <span className="error">{save.error}</span>}
    </div>
  );
}

/** Sections, questions and options are ordered by `position`. */
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

/** Move, edit and delete buttons for one item in an ordered list. */
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
    <span className="controls">
      <button
        type="button"
        aria-label={t("admin.setup.up")}
        title={t("admin.setup.up")}
        disabled={busy || index === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={t("admin.setup.down")}
        title={t("admin.setup.down")}
        disabled={busy || index === count - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
      {children}
      <button type="button" disabled={busy} onClick={onEdit}>
        {t("common.edit")}
      </button>
      <button type="button" className="danger" disabled={busy} onClick={onDelete}>
        {t("common.delete")}
      </button>
    </span>
  );
}
