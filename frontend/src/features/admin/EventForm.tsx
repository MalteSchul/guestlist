import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import {
  isoOf,
  localInput,
  SaveBar,
  TextField,
  useSave,
} from "./forms";

type EventIn = Schemas["EventIn"];

/** The event's own fields, for creating it and for editing it later. */
export function EventForm({
  event,
  label,
  onSubmit,
}: {
  event?: EventIn;
  label?: string;
  onSubmit: (body: EventIn) => Promise<void>;
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
          <input
            type="datetime-local"
            value={endsAt}
            min={startsAt || undefined}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>{t("admin.form.rsvpDeadline")}</span>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
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

      <SaveBar save={save} label={label} />
    </form>
  );
}
