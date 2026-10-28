import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { Icon } from "../../components/Icon";
import { InfoTip } from "../../components/InfoTip";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime, pick } from "../../i18n/text";
import { openRequired, type Progress, personProgress, summary } from "../answers";
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
  const [onlyOpen, setOnlyOpen] = useState(false);
  const unfinished = invites.filter((invite) => inviteProgress(event, invite) !== "done");
  const shown = onlyOpen ? unfinished : invites;
  const persons = invites.flatMap((invite) => invite.persons);
  const coming = persons.filter((person) => person.attendance === "yes");

  return (
    <>
      <div className="row">
        <h1>{pick(event.title, lang)}</h1>
        <a href={`/admin/events/${event.id}/edit`}>{t("admin.event.edit")}</a>
      </div>
      <p className="meta">{formatDateTime(event.starts_at, lang)}</p>

      <ul className="stats" aria-label={t("admin.event.personsTally")}>
        {ATTENDANCE.map((attendance) => {
          const count = persons.filter((person) => person.attendance === attendance).length;
          const label = `${t(`admin.attendance.${attendance}`)}: ${count}`;
          return (
            <li key={attendance} title={label} aria-label={label}>
              {count}
              <AttendanceIcon attendance={attendance} />
            </li>
          );
        })}
      </ul>

      {event.questions.some((question) => question.kind === "choice") && (
        <>
          <h2>
            {t("admin.event.totals")} <InfoTip text={t("admin.event.totalsHint")} />
          </h2>
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

      <div className="row">
        <h2>{t("admin.event.invites", { count: invites.length })}</h2>
        {invites.length > 0 && (
          <button
            type="button"
            className="icon ghost toggle"
            aria-pressed={onlyOpen}
            aria-label={t("admin.event.onlyUnfinished")}
            title={t("admin.event.onlyUnfinished")}
            onClick={() => setOnlyOpen(!onlyOpen)}
          >
            <Icon name="filter" />
          </button>
        )}
      </div>
      {invites.length === 0 && <p className="muted">{t("admin.event.noInvites")}</p>}
      {onlyOpen && unfinished.length === 0 && invites.length > 0 && (
        <p className="muted">{t("admin.event.allFinished")}</p>
      )}
      <ul className="cards">
        {shown.map((invite) => (
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

  // One person under their own name: the person's row is the card's first line, no title above.
  const single =
    invite.persons.length === 1 &&
    invite.persons[0]!.name.trim().toLocaleLowerCase() === invite.name.trim().toLocaleLowerCase();
  const actions = (
    <span className="card-actions">
      <a
        className="icon ghost"
        href={link}
        target="_blank"
        rel="noreferrer"
        aria-label={t("admin.event.openLink")}
        title={t("admin.event.openLink")}
      >
        <Icon name="open" />
      </a>
      <button
        type="button"
        className={copy === "copied" ? "icon ghost done" : "icon ghost"}
        aria-label={t(`admin.event.copy.${copy === "copied" ? "copied" : "idle"}`)}
        title={t(`admin.event.copy.${copy === "copied" ? "copied" : "idle"}`)}
        onClick={() => void copyLink()}
      >
        <Icon name={copy === "copied" ? "check" : "copy"} />
      </button>
      <button
        type="button"
        className="icon ghost danger"
        aria-label={t("common.delete")}
        title={t("common.delete")}
        disabled={action.status === "saving"}
        onClick={remove}
      >
        <Icon name="delete" />
      </button>
    </span>
  );
  const persons = (
    <ul className="persons">
      {invite.persons.map((person) => {
        // Saving "yes" needs every required answer, so this only happens when a question
        // became required after the guest answered.
        const open =
          person.attendance === "yes" ? openRequired(event.questions, person.answers).length : 0;
        const status =
          t(`admin.attendance.${person.attendance}`) +
          (open > 0 ? ` · ${t("admin.event.requiredOpen", { count: open })}` : "");
        return (
          <li key={person.id}>
            <span
              className="status"
              role="img"
              aria-label={status}
              title={status}
            >
              <AttendanceIcon attendance={person.attendance} />
            </span>
            <span>
              {single ? <strong>{person.name}</strong> : person.name}
              {event.guest_list_enabled && person.attendance_public && (
                <span className="badge">{t("admin.event.onGuestList")}</span>
              )}
              {person.answers.length > 0 && (
                <span className="muted">
                  {" "}
                  · {summary(event.questions, person.answers, i18n.language)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <li className={`card progress ${inviteProgress(event, invite)}`}>
      {single ? (
        <div className="row single">
          {persons}
          {actions}
        </div>
      ) : (
        <div className="row">
          <strong>{invite.name}</strong>
          {actions}
        </div>
      )}
      {copy === "failed" && <p className="error">{t("admin.event.copy.failed")}</p>}
      {action.error && <p className="error">{action.error}</p>}
      {!single && persons}
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
