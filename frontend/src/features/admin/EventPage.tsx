import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { AttendanceCounts } from "../../components/AttendanceCounts";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { Icon } from "../../components/Icon";
import { InfoTip } from "../../components/InfoTip";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime } from "../../i18n/text";
import { openRequired, type Progress, personProgress, summary } from "../answers";
import { IconButton, useSave } from "./forms";
import { NewInvite, type NewInviteKind } from "./NewInvite";

type Event = Schemas["EventOut"];
type Invite = Schemas["InviteOut"];
type Person = Schemas["PersonOut"];

/** The overview: who is coming, what they chose, and the invites. Setup is on EventSetup. */
export function EventPage({ eventId }: { eventId: string }) {
  const params = { path: { event_id: eventId } };
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);
  const invites = useLoad(
    () => unwrap(api.GET("/api/admin/events/{event_id}/invites", { params })),
    [eventId],
  );

  return (
    <Layout admin>
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
  const [adding, setAdding] = useState<NewInviteKind>();
  const groups = useLoad(() => unwrap(api.GET("/api/admin/groups")), []);
  const unfinished = invites.filter((invite) => inviteProgress(event, invite) !== "done");
  const shown = onlyOpen ? unfinished : invites;
  const persons = invites.flatMap((invite) => invite.persons);
  const coming = persons.filter((person) => person.attendance === "yes");

  return (
    <>
      <div className="row title-row">
        <h1>{event.title}</h1>
        <span className="heading-actions">
          <a
            className="icon"
            href="/"
            aria-label={t("admin.event.back")}
            title={t("admin.event.back")}
          >
            <Icon name="back" />
          </a>
          <a
            className="icon"
            href={`/admin/events/${event.id}/stats`}
            aria-label={t("admin.event.stats")}
            title={t("admin.event.stats")}
          >
            <Icon name="chart" />
          </a>
          <a
            className="icon"
            href={`/admin/events/${event.id}/edit`}
            aria-label={t("admin.event.edit")}
            title={t("admin.event.edit")}
          >
            <Icon name="edit" />
          </a>
        </span>
      </div>
      <p className="meta">{formatDateTime(event.starts_at, lang)}</p>

      <AttendanceCounts counts={countAttendance(persons)} />

      {event.questions.some((question) => question.kind === "choice") && (
        <>
          <h2>
            {t("admin.event.totals")} <InfoTip text={t("admin.event.totalsHint")} />
          </h2>
          {event.questions
            .filter((question) => question.kind === "choice")
            .map((question) => (
              <div key={question.id} className="card">
                <strong>{question.label}</strong>
                <ul className="totals">
                  {question.options.map((option) => (
                    <li key={option.id}>
                      <span className={option.active ? undefined : "muted"}>
                        {option.label}
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
        <span className="heading-actions">
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
          {!adding && (
            <IconButton
              icon="personAdd"
              label={t("admin.event.newInvite")}
              accent
              onClick={() => setAdding("persons")}
            />
          )}
          {!adding && (groups.data?.length ?? 0) > 0 && (
            <IconButton
              icon="groupAdd"
              label={t("admin.event.inviteGroup")}
              accent
              onClick={() => setAdding("group")}
            />
          )}
        </span>
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
      {adding && (
        <NewInvite
          kind={adding}
          event={event}
          invites={invites}
          groups={groups.data ?? []}
          onCreated={(created) => onChange([...invites, ...created])}
          onClose={() => setAdding(undefined)}
        />
      )}
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
  const { t } = useTranslation();
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
            {event.guest_list_enabled && <GuestListIcon person={person} />}
            <span>
              {single ? <strong>{person.name}</strong> : person.name}
              {person.answers.length > 0 && (
                <span className="muted">
                  {" "}
                  · {summary(event.questions, person.answers)}
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

/** An eye when other guests see this person on the guest list: only with "yes" or "maybe", and
 * only if they agreed (D33). Otherwise just the space, so names line up. */
function GuestListIcon({ person }: { person: Person }) {
  const { t } = useTranslation();
  const listed =
    person.attendance_public && (person.attendance === "yes" || person.attendance === "maybe");
  if (!listed) return <span className="status" aria-hidden="true" />;
  const label = t("admin.event.onGuestList");
  return (
    <span className="status" role="img" aria-label={label} title={label}>
      <Icon name="show" />
    </span>
  );
}

function countAttendance(persons: Person[]): Schemas["AttendanceCounts"] {
  const counts = { yes: 0, maybe: 0, no: 0, pending: 0 };
  for (const person of persons) counts[person.attendance] += 1;
  return counts;
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
