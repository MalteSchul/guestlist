import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime, pick } from "../../i18n/text";
import { openRequired, PROGRESS, type Progress, personProgress, summary } from "../answers";
import { useSave } from "./forms";
import { NewInvite } from "./NewInvite";

type Event = Schemas["EventOut"];
type Invite = Schemas["InviteOut"];
type Person = Schemas["PersonOut"];

const ATTENDANCE = ["yes", "maybe", "no", "pending"] as const;

/** The overview: who is coming, what they chose, and the invites. Setup is on EventSetup. */
export function EventPage({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const params = { path: { event_id: eventId } };
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);
  const invites = useLoad(
    () => unwrap(api.GET("/api/admin/events/{event_id}/invites", { params })),
    [eventId],
  );

  return (
    <Layout admin>
      <p>
        <a href="/">← {t("admin.event.back")}</a>
      </p>
      <Loaded {...event}>
        {(event) => (
          <Loaded {...invites}>
            {(list) => <EventDetails event={event} invites={list} onChange={invites.setData} />}
          </Loaded>
        )}
      </Loaded>
    </Layout>
  );
}

function EventDetails({
  event,
  invites,
  onChange,
}: {
  event: Event;
  invites: Invite[];
  onChange: (invites: Invite[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const persons = invites.flatMap((invite) => invite.persons);
  const coming = persons.filter((person) => person.attendance === "yes");

  return (
    <>
      <div className="row">
        <h1>{pick(event.title, lang)}</h1>
        <a href={`/admin/events/${event.id}/edit`}>{t("admin.event.edit")}</a>
      </div>
      <p className="meta">{formatDateTime(event.starts_at, lang)}</p>

      <p className="tally">
        <span className="muted">{t("admin.event.invitesTally")}</span>
        {PROGRESS.map((progress) => (
          <span key={progress} className={`badge ${progress}`}>
            {t(`admin.progress.${progress}`)}:{" "}
            {invites.filter((invite) => inviteProgress(event, invite) === progress).length}
          </span>
        ))}
      </p>
      <p className="tally">
        <span className="muted">{t("admin.event.personsTally")}</span>
        {ATTENDANCE.map((attendance) => (
          <span key={attendance} className="badge">
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
                      <span className={option.active ? undefined : "muted"}>
                        {pick(option.label, lang)}
                        {!option.active && ` (${t("admin.setup.hidden")})`}
                      </span>
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
          <InviteCard
            key={invite.id}
            event={event}
            invite={invite}
            onDeleted={() => onChange(invites.filter((i) => i.id !== invite.id))}
          />
        ))}
      </ul>
      <NewInvite
        event={event}
        invites={invites}
        onCreated={(created) => onChange([...invites, ...created])}
      />
    </>
  );
}

function InviteCard({
  event,
  invite,
  onDeleted,
}: {
  event: Event;
  invite: Invite;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const action = useSave();
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

  function remove() {
    if (!window.confirm(t("admin.event.confirmDeleteInvite", { name: invite.name }))) return;
    void action.run(async () => {
      await unwrap(
        api.DELETE("/api/admin/events/{event_id}/invites/{invite_id}", {
          params: { path: { event_id: event.id, invite_id: invite.id } },
        }),
      );
      onDeleted();
    });
  }

  return (
    <li className={`card progress ${inviteProgress(event, invite)}`}>
      <div className="row">
        <strong>{invite.name}</strong>
        <span className="row">
          <a href={link} target="_blank" rel="noreferrer">
            {t("admin.event.openLink")}
          </a>
          <button type="button" onClick={() => void copyLink()}>
            {t(`admin.event.copy.${copy}`)}
          </button>
          <button
            type="button"
            className="danger"
            disabled={action.status === "saving"}
            onClick={remove}
          >
            {t("common.delete")}
          </button>
        </span>
      </div>
      {action.error && <p className="error">{action.error}</p>}
      <ul className="persons">
        {invite.persons.map((person) => {
          // Saving "yes" needs every required answer, so this only happens when a question
          // became required after the guest answered.
          const open =
            person.attendance === "yes" ? openRequired(event.questions, person.answers).length : 0;
          return (
            <li key={person.id}>
              <span className={`badge ${progressOf(event, person)}`}>
                {t(`admin.attendance.${person.attendance}`)}
                {open > 0 && ` · ${t("admin.event.requiredOpen", { count: open })}`}
              </span>{" "}
              {person.name}
              {event.guest_list_enabled && person.attendance_public && (
                <span className="badge">{t("admin.event.onGuestList")}</span>
              )}
              {person.answers.length > 0 && (
                <span className="muted">
                  {" "}
                  · {summary(event.questions, person.answers, i18n.language)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {invite.comment && (
        <p className="prose muted">{t("admin.event.comment", { comment: invite.comment })}</p>
      )}
    </li>
  );
}

const progressOf = (event: Event, person: Person) =>
  personProgress(event.questions, person.attendance, person.answers);

/** Red while nobody answered, green once everyone is done, yellow in between. */
function inviteProgress(event: Event, invite: Invite): Progress {
  const all = invite.persons.map((person) => progressOf(event, person));
  if (all.every((progress) => progress === "open")) return "open";
  if (all.every((progress) => progress === "done")) return "done";
  return "partial";
}

function picked(person: Person, questionId: string, optionId: string): boolean {
  return person.answers.some((a) => a.question_id === questionId && a.option_ids.includes(optionId));
}
