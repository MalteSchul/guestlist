import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { type Language, LANGUAGES } from "../../i18n";
import {
  isoOf,
  localInput,
  requiredText,
  SaveBar,
  textDraft,
  translated,
  TranslatedField,
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
  const { t, i18n } = useTranslation();
  const save = useSave();
  const [title, setTitle] = useState(textDraft(event?.title));
  const [description, setDescription] = useState(textDraft(event?.description));
  const [location, setLocation] = useState(event?.location ?? "");
  const [startsAt, setStartsAt] = useState(localInput(event?.starts_at));
  const [endsAt, setEndsAt] = useState(localInput(event?.ends_at));
  const [deadline, setDeadline] = useState(localInput(event?.rsvp_deadline));
  const [language, setLanguage] = useState<Language>(
    event?.default_language ?? (i18n.language === "en" ? "en" : "de"),
  );
  const [keepData, setKeepData] = useState(event?.keep_data ?? false);

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() =>
      onSubmit({
        title: requiredText(title),
        description: translated(description),
        location: location.trim() || null,
        starts_at: isoOf(startsAt)!,
        ends_at: isoOf(endsAt),
        rsvp_deadline: isoOf(deadline),
        default_language: language,
        keep_data: keepData,
        // Not shown to guests yet, so not offered here; PUT replaces everything, so keep it.
        guest_list_enabled: event?.guest_list_enabled ?? false,
      }),
    );
  }

  return (
    <form onSubmit={submit} onChange={save.reset}>
      <fieldset className="field plain">
        <legend>{t("admin.form.defaultLanguage")}</legend>
        <div className="choices">
          {LANGUAGES.map((lang) => (
            <label key={lang} className="choice">
              <input
                type="radio"
                name="default_language"
                checked={language === lang}
                onChange={() => setLanguage(lang)}
              />
              {t(`admin.form.languages.${lang}`)}
            </label>
          ))}
        </div>
        <span className="hint">{t("admin.form.defaultLanguageHint")}</span>
      </fieldset>

      <TranslatedField
        label={t("admin.form.title")}
        value={title}
        onChange={setTitle}
        language={language}
        required
      />
      <TranslatedField
        label={t("admin.form.description")}
        value={description}
        onChange={setDescription}
        language={language}
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

      <SaveBar save={save} label={label} />
    </form>
  );
}
