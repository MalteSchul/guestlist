import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import {
  IconButton,
  isoOf,
  localInput,
  SaveBar,
  TextField,
  useSave,
} from "./forms";

type EventIn = Schemas["EventIn"];

/** An optional date and time. The browser's own field can only be emptied by blanking each part
 * of it, so a button next to it clears it at once. */
function OptionalDateTime({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="with-clear">
      <input type="datetime-local" value={value} min={min} onChange={(e) => onChange(e.target.value)} />
      {value && <IconButton icon="close" label={t("admin.form.clear")} onClick={() => onChange("")} />}
    </div>
  );
}

/** The event's own fields, for creating it and for editing it later. With `onCancel`, Cancel
 * closes the form; without, it puts back what is stored. */
export function EventForm({
  event,
  label,
  onSubmit,
  onCancel,
}: {
  event?: EventIn;
  label?: string;
  onSubmit: (body: EventIn) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startsAt, setStartsAt] = useState(localInput(event?.starts_at));
  const [endsAt, setEndsAt] = useState(localInput(event?.ends_at));
  const [deadline, setDeadline] = useState(localInput(event?.rsvp_deadline));
  const [keepData, setKeepData] = useState(event?.keep_data ?? false);
  const [guestList, setGuestList] = useState(event?.guest_list_enabled ?? false);

  // What is stored, for knowing whether anything changed and for Cancel to go back to.
  const stored = {
    title: event?.title ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    startsAt: localInput(event?.starts_at),
    endsAt: localInput(event?.ends_at),
    deadline: localInput(event?.rsvp_deadline),
    keepData: event?.keep_data ?? false,
    guestList: event?.guest_list_enabled ?? false,
  };
  const changed =
    title.trim() !== stored.title ||
    description.trim() !== stored.description ||
    location.trim() !== stored.location ||
    startsAt !== stored.startsAt ||
    endsAt !== stored.endsAt ||
    deadline !== stored.deadline ||
    keepData !== stored.keepData ||
    guestList !== stored.guestList;

  function revert() {
    setTitle(stored.title);
    setDescription(stored.description);
    setLocation(stored.location);
    setStartsAt(stored.startsAt);
    setEndsAt(stored.endsAt);
    setDeadline(stored.deadline);
    setKeepData(stored.keepData);
    setGuestList(stored.guestList);
    save.reset();
    save.clearError();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() =>
      onSubmit({
        title: title,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: isoOf(startsAt)!,
        ends_at: isoOf(endsAt),
        rsvp_deadline: isoOf(deadline),
        keep_data: keepData,
        guest_list_enabled: guestList,
      }),
    );
  }

  return (
    <form onSubmit={submit} onChange={save.reset}>
      <TextField
        label={t("admin.form.title")}
        value={title}
        onChange={setTitle}
        required
      />
      <TextField
        label={t("admin.form.description")}
        value={description}
        onChange={setDescription}
        multiline
      />

      <label className="field">
        <span>{t("admin.form.location")}</span>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>

      <div className="columns">
        <label className="field">
          <span>{t("admin.form.startsAt")} *</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>{t("admin.form.endsAt")}</span>
          <OptionalDateTime value={endsAt} min={startsAt || undefined} onChange={setEndsAt} />
        </label>
      </div>

      <label className="field">
        <span>{t("admin.form.rsvpDeadline")}</span>
        <OptionalDateTime value={deadline} onChange={setDeadline} />
        <span className="hint">{t("admin.form.rsvpDeadlineHint")}</span>
      </label>

      <div className="field">
        <label className="choice">
          <input type="checkbox" checked={keepData} onChange={(e) => setKeepData(e.target.checked)} />
          {t("admin.form.keepData")}
        </label>
        <span className="hint">{t("admin.form.keepDataHint")}</span>
      </div>

      <div className="field">
        <label className="choice">
          <input
            type="checkbox"
            checked={guestList}
            onChange={(e) => setGuestList(e.target.checked)}
          />
          {t("admin.form.guestList")}
        </label>
        <span className="hint">{t("admin.form.guestListHint")}</span>
      </div>

      <SaveBar
        save={save}
        label={label}
        onCancel={onCancel ?? revert}
        disabled={!changed}
        cancelDisabled={(!onCancel && !changed) || save.status === "saving"}
      />
    </form>
  );
}
