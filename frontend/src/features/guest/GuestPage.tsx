import i18next from "i18next";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, api, type Schemas, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { preferredLanguage } from "../../i18n";
import { formatDateTime, pick } from "../../i18n/text";

type Invite = Schemas["GuestInviteOut"];
type Question = Schemas["GuestQuestion"];
type Attendance = Schemas["PersonOut"]["attendance"];
type Answer = { option_ids: string[]; text_value: string };
type Draft = { attendance: Attendance; answers: Record<string, Answer> };

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
  const [drafts, setDrafts] = useState(() => draftsOf(invite));
  const [comment, setComment] = useState(invite.comment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();

  function update(personId: string, change: Partial<Draft>) {
    setStatus("idle");
    setDrafts((all) => ({ ...all, [personId]: { ...all[personId]!, ...change } }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(undefined);
    try {
      await onSave(requestOf(drafts, comment));
      setStatus("saved");
    } catch (failure) {
      setStatus("idle");
      setError(failure instanceof ApiError && failure.message ? failure.message : t("common.error"));
    }
  }

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

      <h2>{t("guest.yourAnswer", { name: invite.name })}</h2>
      <p className="muted">
        {event.answers_open
          ? t("guest.answerUntil", { date: formatDateTime(event.answers_close_at, lang) })
          : t("guest.closed")}
      </p>

      <form onSubmit={submit}>
        <fieldset disabled={!event.answers_open || status === "saving"} className="plain">
          {invite.persons.map((person) => {
            const draft = drafts[person.id]!;
            return (
              <fieldset key={person.id} className="card person">
                <legend>{person.name}</legend>
                <div className="choices">
                  {CHOICES.map((choice) => (
                    <label key={choice} className="choice">
                      <input
                        type="radio"
                        name={`attendance-${person.id}`}
                        checked={draft.attendance === choice}
                        onChange={() => update(person.id, { attendance: choice })}
                        required
                      />
                      {t(`guest.attendance.${choice}`)}
                    </label>
                  ))}
                </div>
                {seesQuestions(draft.attendance) &&
                  event.questions.map((question) => (
                    <QuestionField
                      key={question.id}
                      name={`${person.id}-${question.id}`}
                      question={question}
                      required={question.required && draft.attendance === "yes"}
                      answer={draft.answers[question.id] ?? { option_ids: [], text_value: "" }}
                      onChange={(answer) =>
                        update(person.id, { answers: { ...draft.answers, [question.id]: answer } })
                      }
                    />
                  ))}
              </fieldset>
            );
          })}

          <label className="field">
            <span>{t("guest.comment")}</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </label>

          <div className="actions">
            <button type="submit" className="primary">
              {status === "saving" ? t("common.saving") : t("common.save")}
            </button>
            {status === "saved" && <span className="success">{t("guest.saved")}</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </fieldset>
      </form>
    </>
  );
}

function QuestionField({
  name,
  question,
  required,
  answer,
  onChange,
}: {
  name: string;
  question: Question;
  required: boolean;
  answer: Answer;
  onChange: (answer: Answer) => void;
}) {
  const { i18n } = useTranslation();
  const label = pick(question.label, i18n.language) + (required ? " *" : "");

  if (question.kind === "text") {
    return (
      <label className="field">
        <span>{label}</span>
        <textarea
          rows={2}
          value={answer.text_value}
          required={required}
          onChange={(e) => onChange({ ...answer, text_value: e.target.value })}
        />
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
      <legend>{label}</legend>
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
    </fieldset>
  );
}

function draftsOf(invite: Invite): Record<string, Draft> {
  return Object.fromEntries(
    invite.persons.map((person) => [
      person.id,
      {
        attendance: person.attendance,
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

/** The whole state, as the backend expects it (D30). Questions are only sent for yes/maybe. */
function requestOf(drafts: Record<string, Draft>, comment: string): Schemas["GuestResponseIn"] {
  return {
    comment: comment.trim() || null,
    persons: Object.entries(drafts).map(([id, draft]) => ({
      id,
      attendance: draft.attendance,
      answers: seesQuestions(draft.attendance)
        ? Object.entries(draft.answers)
            .map(([question_id, a]) => ({
              question_id,
              option_ids: a.option_ids,
              text_value: a.text_value.trim() || null,
            }))
            .filter((a) => a.option_ids.length > 0 || a.text_value !== null)
        : [],
    })),
  };
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
