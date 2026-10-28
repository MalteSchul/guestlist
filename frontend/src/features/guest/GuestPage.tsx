import i18next from "i18next";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, api, type Schemas, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { preferredLanguage } from "../../i18n";
import { formatDateTime, pick } from "../../i18n/text";
import { openRequired, personProgress, summary } from "../answers";

type Invite = Schemas["GuestInviteOut"];
type Person = Schemas["PersonOut"];
type Question = Schemas["GuestQuestion"];
type Attendance = Person["attendance"];
type Answer = { option_ids: string[]; text_value: string };
type Draft = { attendance: Attendance; attendance_public: boolean; answers: Record<string, Answer> };

const CHOICES = ["yes", "maybe", "no"] as const;
// "yes" and "maybe" see the questions; only "yes" must answer the required ones (D27).
const seesQuestions = (attendance: Attendance) => attendance === "yes" || attendance === "maybe";

export function GuestPage({ token }: { token: string }) {
  const params = { header: { "X-Invite-Token": token } };
  const invite = useLoad(() => unwrap(api.GET("/api/guest/invite", { params })), [token]);

  // Written in one language only: show that one, without the switch. In both: the choice or the
  // browser's, as on every page (A21). The forced language isn't stored as a choice.
  const languages = invite.data?.event.languages;
  const only = languages?.length === 1 ? languages[0] : undefined;
  useEffect(() => {
    void i18next.changeLanguage(only ?? preferredLanguage());
  }, [only]);

  async function save(body: Schemas["GuestResponseIn"]) {
    invite.setData(await unwrap(api.PUT("/api/guest/invite", { params, body })));
  }

  return (
    <Layout switcher={!only}>
      <Loaded {...invite}>{(data) => <Invitation invite={data} onSave={save} />}</Loaded>
    </Layout>
  );
}

function Invitation({
  invite,
  onSave,
}: {
  invite: Invite;
  onSave: (body: Schemas["GuestResponseIn"]) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { event } = invite;
  const count = invite.persons.length; // "du" for one person, "ihr" for several (A23)
  const [drafts, setDrafts] = useState(() => draftsOf(invite));
  const [comment, setComment] = useState(invite.comment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [unsaved, setUnsaved] = useState(false);
  const [tried, setTried] = useState(false); // to save with a gap; only then are gaps marked
  const [reopened, setReopened] = useState<string[]>([]); // done persons opened with "Change"
  const [error, setError] = useState<string>();

  function changed() {
    setStatus("idle");
    setUnsaved(true);
  }

  function update(personId: string, change: Partial<Draft>) {
    changed();
    setDrafts((all) => ({ ...all, [personId]: { ...all[personId]!, ...change } }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(undefined);
    try {
      await onSave(requestOf(drafts, comment));
      setStatus("saved");
      setUnsaved(false);
      setTried(false);
      setReopened([]);
    } catch (failure) {
      setStatus("idle");
      setError(failure instanceof ApiError && failure.message ? failure.message : t("common.error"));
    }
  }

  // Sorted by what's saved, not what's typed, so nobody moves while the guest is still clicking.
  // Done: "no", or "yes" with every required question answered. "Maybe" isn't done.
  const isDone = (person: Person) =>
    personProgress(event.questions, person.attendance, person.answers) === "done";
  const toAnswer = invite.persons.filter((person) => !isDone(person));
  const done = invite.persons.filter(isDone);

  const form = (person: Person) => (
    <PersonForm
      key={person.id}
      person={person}
      draft={drafts[person.id]!}
      questions={event.questions}
      guestList={event.guest_list_enabled}
      named={count > 1}
      tried={tried}
      onChange={(change) => update(person.id, change)}
    />
  );

  return (
    <>
      <h1>{pick(event.title, lang)}</h1>
      <p className="meta">
        {formatDateTime(event.starts_at, lang)}
        {event.ends_at && ` – ${formatDateTime(event.ends_at, lang)}`}
      </p>
      {event.location && (
        <p className="meta">
          <a href={mapsUrl(event.location)} target="_blank" rel="noreferrer">
            {event.location}
          </a>
        </p>
      )}
      {event.description && <p className="prose">{pick(event.description, lang)}</p>}

      {event.sections.map((section) => (
        <section key={section.id} className="card">
          <h2>{pick(section.title, lang)}</h2>
          <p className="prose">{pick(section.body, lang)}</p>
        </section>
      ))}

      {invite.guest_list && <GuestList entries={invite.guest_list} />}

      <h2>{t("guest.yourAnswer", { name: invite.name, count })}</h2>
      <p className="muted">
        {event.answers_open
          ? t("guest.answerUntil", { date: formatDateTime(event.answers_close_at, lang), count })
          : t("guest.closed")}
      </p>

      {/* Native validation stops the save on the first gap; from then on all gaps are marked. */}
      <form onSubmit={submit} onInvalidCapture={() => setTried(true)}>
        <fieldset disabled={!event.answers_open || status === "saving"} className="plain">
          {toAnswer.length > 0 && (
            <>
              {done.length > 0 && <h3>{t("guest.toAnswer")}</h3>}
              {toAnswer.map(form)}
            </>
          )}

          {done.length > 0 && (
            <>
              <h3>{t("guest.done")}</h3>
              {/* One card with a row per person, like the summary at the end of a checkout.
                  "Change" opens the person's form inside their row. */}
              <ul className="card done-list">
                {done.map((person) =>
                  reopened.includes(person.id) ? (
                    <li key={person.id}>{form(person)}</li>
                  ) : (
                    <li key={person.id} className="done-row">
                      <span>
                        <strong>{person.name}</strong> –{" "}
                        {t(`guest.answered.${person.attendance}`)}
                        {event.guest_list_enabled && person.attendance_public && (
                          <span className="muted"> · {t("guest.listed")}</span>
                        )}
                        {person.answers.length > 0 && (
                          <span className="muted">
                            {" "}
                            · {summary(event.questions, person.answers, lang)}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReopened((all) => [...all, person.id])}
                      >
                        {t("guest.change")}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </>
          )}

          <label className="field">
            <span>{t("guest.comment")}</span>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                changed();
              }}
              rows={3}
            />
          </label>

          <div className="actions">
            <button type="submit" className="primary">
              {status === "saving" ? t("common.saving") : t("common.save")}
            </button>
            {status === "saved" && (
              <span className="success">
                {t("guest.saved", { date: formatDateTime(event.answers_close_at, lang), count })}
              </span>
            )}
            {unsaved && status === "idle" && <span className="unsaved">{t("guest.unsaved")}</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </fieldset>
      </form>
    </>
  );
}

function PersonForm({
  person,
  draft,
  questions,
  guestList,
  named,
  tried,
  onChange,
}: {
  person: Person;
  draft: Draft;
  questions: Question[];
  /** The host shows a guest list, so this person may agree to be on it (D33). */
  guestList: boolean;
  /** Several people answer here, so each card says whose it is. */
  named: boolean;
  tried: boolean;
  onChange: (change: Partial<Draft>) => void;
}) {
  const { t } = useTranslation();
  const sees = seesQuestions(draft.attendance);
  const missing = draft.attendance === "yes" ? openRequired(questions, answersOf(draft)) : [];
  // Saved as "yes" before the question became required: new to them, not a mistake.
  const added = person.attendance === "yes" ? openRequired(questions, person.answers) : [];

  return (
    <fieldset id={`person-${person.id}`} className="card person">
      <legend className={named ? undefined : "sr-only"}>{person.name}</legend>
      <div className="choices">
        {CHOICES.map((choice) => (
          <label key={choice} className="choice">
            <input
              type="radio"
              name={`attendance-${person.id}`}
              checked={draft.attendance === choice}
              onChange={() => onChange({ attendance: choice })}
              required
            />
            {t(`guest.attendance.${choice}`)}
          </label>
        ))}
      </div>
      {tried && draft.attendance === "pending" && (
        <span className="hint missing">{t("guest.missing")}</span>
      )}
      {/* Always rendered and folded open, so the questions slide in instead of popping up.
          Disabled while folded, so their required fields don't block saving a "no". */}
      <div className={sees ? "reveal open" : "reveal"} inert={!sees}>
        <fieldset disabled={!sees} className="plain">
          {guestList && (
            <div className="field">
              <label className="choice">
                <input
                  type="checkbox"
                  checked={draft.attendance_public}
                  onChange={(e) => onChange({ attendance_public: e.target.checked })}
                />
                {t("guest.showOnList")}
              </label>
              <span className="hint">{t("guest.showOnListHint")}</span>
            </div>
          )}
          {questions.map((question) => (
            <QuestionField
              key={question.id}
              name={`${person.id}-${question.id}`}
              question={question}
              required={question.required && draft.attendance === "yes"}
              missing={tried && missing.includes(question)}
              isNew={added.includes(question)}
              answer={draft.answers[question.id] ?? { option_ids: [], text_value: "" }}
              onChange={(answer) => onChange({ answers: { ...draft.answers, [question.id]: answer } })}
            />
          ))}
        </fieldset>
      </div>
    </fieldset>
  );
}

function QuestionField({
  name,
  question,
  required,
  missing,
  isNew,
  answer,
  onChange,
}: {
  name: string;
  question: Question;
  required: boolean;
  /** Required and still empty, after the guest tried to save. */
  missing: boolean;
  /** Became required after the guest answered. */
  isNew: boolean;
  answer: Answer;
  onChange: (answer: Answer) => void;
}) {
  const { t, i18n } = useTranslation();
  const label = (
    <>
      {pick(question.label, i18n.language) + (required ? " *" : "")}
      {isNew && <span className="badge">{t("guest.new")}</span>}
    </>
  );
  const labelClass = missing ? "missing" : undefined;
  const note = missing && <span className="hint missing">{t("guest.missing")}</span>;

  if (question.kind === "text") {
    return (
      <label className="field">
        <span className={labelClass}>{label}</span>
        <textarea
          rows={2}
          value={answer.text_value}
          required={required}
          onChange={(e) => onChange({ ...answer, text_value: e.target.value })}
        />
        {note}
      </label>
    );
  }

  const toggle = (id: string, on: boolean) =>
    onChange({
      ...answer,
      option_ids: on ? [...answer.option_ids, id] : answer.option_ids.filter((o) => o !== id),
    });

  return (
    <fieldset className="field plain">
      <legend className={labelClass}>{label}</legend>
      <div className="choices">
        {question.options.map((option) => (
          <label key={option.id} className="choice">
            {question.multiple ? (
              <input
                type="checkbox"
                checked={answer.option_ids.includes(option.id)}
                onChange={(e) => toggle(option.id, e.target.checked)}
              />
            ) : (
              <input
                type="radio"
                name={name}
                checked={answer.option_ids[0] === option.id}
                required={required}
                onChange={() => onChange({ ...answer, option_ids: [option.id] })}
              />
            )}
            {pick(option.label, i18n.language)}
          </label>
        ))}
      </div>
      {note}
    </fieldset>
  );
}

/** Who's coming, for guests: only people who agreed, nothing but names (D33). */
function GuestList({ entries }: { entries: Schemas["GuestListEntry"][] }) {
  const { t } = useTranslation();
  const names = (attendance: Attendance) =>
    entries.filter((entry) => entry.attendance === attendance).map((entry) => entry.name);
  const coming = names("yes");
  const maybe = names("maybe");
  return (
    <section className="card">
      <h2>{t("guest.guestList")}</h2>
      {entries.length === 0 ? (
        <p className="muted">{t("guest.guestListEmpty")}</p>
      ) : (
        <>
          {coming.length > 0 && (
            <p>
              <strong>{t("guest.listComing", { count: coming.length })}</strong> {coming.join(", ")}
            </p>
          )}
          {maybe.length > 0 && (
            <p>
              <strong>{t("guest.listMaybe", { count: maybe.length })}</strong> {maybe.join(", ")}
            </p>
          )}
        </>
      )}
      <p className="hint">{t("guest.guestListHint")}</p>
    </section>
  );
}

function draftsOf(invite: Invite): Record<string, Draft> {
  return Object.fromEntries(
    invite.persons.map((person) => [
      person.id,
      {
        attendance: person.attendance,
        attendance_public: person.attendance_public,
        answers: Object.fromEntries(
          person.answers.map((a) => [
            a.question_id,
            { option_ids: a.option_ids, text_value: a.text_value ?? "" },
          ]),
        ),
      },
    ]),
  );
}

/** The answers as the backend takes them. Questions are only answered for yes/maybe. */
function answersOf(draft: Draft) {
  if (!seesQuestions(draft.attendance)) return [];
  return Object.entries(draft.answers)
    .map(([question_id, a]) => ({
      question_id,
      option_ids: a.option_ids,
      text_value: a.text_value.trim() || null,
    }))
    .filter((a) => a.option_ids.length > 0 || a.text_value !== null);
}

/** The whole state, as the backend expects it (D30). */
function requestOf(drafts: Record<string, Draft>, comment: string): Schemas["GuestResponseIn"] {
  return {
    comment: comment.trim() || null,
    persons: Object.entries(drafts).map(([id, draft]) => ({
      id,
      attendance: draft.attendance,
      attendance_public: draft.attendance_public,
      answers: answersOf(draft),
    })),
  };
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
