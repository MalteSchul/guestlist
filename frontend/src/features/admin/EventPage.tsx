import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime, pick } from "../../i18n/text";

type Event = Schemas["EventOut"];
type Invite = Schemas["InviteOut"];
type Person = Schemas["PersonOut"];

const ATTENDANCE = ["yes", "maybe", "no", "pending"] as const;

/** Read-only for now: hosts create and change things through the API docs (A18). */
export function EventPage({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const params = { path: { event_id: eventId } };
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);
  const invites = useLoad(
    () => unwrap(api.GET("/api/admin/events/{event_id}/invites", { params })),
    [eventId],
  );

  return (
    <Layout>
      <p>
        <a href="/">← {t("admin.event.back")}</a>
      </p>
      <Loaded {...event}>
        {(event) => (
          <Loaded {...invites}>{(invites) => <EventDetails event={event} invites={invites} />}</Loaded>
        )}
      </Loaded>
    </Layout>
  );
}

function EventDetails({ event, invites }: { event: Event; invites: Invite[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const persons = invites.flatMap((invite) => invite.persons);
  const coming = persons.filter((person) => person.attendance === "yes");

  return (
    <>
      <h1>{pick(event.title, lang)}</h1>
      <p className="meta">{formatDateTime(event.starts_at, lang)}</p>

      <p className="tally">
        {ATTENDANCE.map((attendance) => (
          <span key={attendance} className={`badge ${attendance}`}>
            {t(`admin.attendance.${attendance}`)}:{" "}
            {persons.filter((person) => person.attendance === attendance).length}
          </span>
        ))}
      </p>

      {event.questions.some((question) => question.kind === "choice") && (
        <>
          <h2>{t("admin.event.totals")}</h2>
          <p className="muted">{t("admin.event.totalsHint")}</p>
          {event.questions
            .filter((question) => question.kind === "choice")
            .map((question) => (
              <div key={question.id} className="card">
                <strong>{pick(question.label, lang)}</strong>
                <ul className="totals">
                  {question.options.map((option) => (
                    <li key={option.id}>
                      <span>{pick(option.label, lang)}</span>
                      <span>{coming.filter((p) => picked(p, question.id, option.id)).length}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}

      <h2>{t("admin.event.invites", { count: invites.length })}</h2>
      {invites.length === 0 && <p className="muted">{t("admin.event.noInvites")}</p>}
      <ul className="cards">
        {invites.map((invite) => (
          <InviteCard key={invite.id} event={event} invite={invite} />
        ))}
      </ul>
    </>
  );
}

function InviteCard({ event, invite }: { event: Event; invite: Invite }) {
  const { t, i18n } = useTranslation();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const link = `${window.location.origin}/i/${invite.token}`;

  useEffect(() => {
    if (copy !== "copied") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  // The clipboard only exists on HTTPS and localhost; elsewhere `navigator.clipboard` is undefined.
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <li className="card">
      <div className="row">
        <strong>{invite.name}</strong>
        <span className="row">
          <a href={link} target="_blank" rel="noreferrer">
            {t("admin.event.openLink")}
          </a>
          <button type="button" onClick={() => void copyLink()}>
            {t(`admin.event.copy.${copy}`)}
          </button>
        </span>
      </div>
      <ul className="persons">
        {invite.persons.map((person) => (
          <li key={person.id}>
            <span className={`badge ${person.attendance}`}>
              {t(`admin.attendance.${person.attendance}`)}
            </span>{" "}
            {person.name}
            {person.answers.length > 0 && (
              <span className="muted"> · {summary(event, person, i18n.language)}</span>
            )}
          </li>
        ))}
      </ul>
      {invite.comment && <p className="prose muted">„{invite.comment}“</p>}
    </li>
  );
}

function picked(person: Person, questionId: string, optionId: string): boolean {
  return person.answers.some((a) => a.question_id === questionId && a.option_ids.includes(optionId));
}

/** "Essen: Vegetarisch; Allergien: Nüsse" */
function summary(event: Event, person: Person, lang: string): string {
  return event.questions
    .flatMap((question) => {
      const answer = person.answers.find((a) => a.question_id === question.id);
      if (!answer) return [];
      const value =
        answer.text_value ??
        question.options
          .filter((option) => answer.option_ids.includes(option.id))
          .map((option) => pick(option.label, lang))
          .join(", ");
      return [`${pick(question.label, lang)}: ${value}`];
    })
    .join("; ");
}
