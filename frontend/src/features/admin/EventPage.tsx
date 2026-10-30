import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { AttendanceCounts } from "../../components/AttendanceCounts";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { Icon, type IconName } from "../../components/Icon";
import { EventWhenWhere } from "../../components/EventWhenWhere";
import { ExpandableText } from "../../components/ExpandableText";
import { InfoTip } from "../../components/InfoTip";
import { Layout, Loaded } from "../../components/Layout";
import { SortMenu } from "../../components/SortMenu";
import { useLoad } from "../../components/useLoad";
import { formatDateTime, nameCollator, sortedByName } from "../../i18n/text";
import { useProgressMark } from "../../progressMark";
import { hasAnswer, openRequired, type Progress, personProgress, summary } from "../answers";
import { IconButton, useSave } from "./forms";
import { NewInvite, type NewInviteKind } from "./NewInvite";
import { QuestionAnswers } from "./QuestionAnswers";

type Event = Schemas["EventOut"];
const ALL_QUESTIONS = "all"; // the question filter's "no question"
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
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [order, setOrder] = useState<InviteOrder>("name-asc");
  // Narrowing the invites to one question: its answers only, and optionally only those who gave one.
  const [questionId, setQuestionId] = useState(ALL_QUESTIONS);
  const [onlyAnswered, setOnlyAnswered] = useState(false);
  const [adding, setAdding] = useState<NewInviteKind>();
  const groups = useLoad(() => unwrap(api.GET("/api/admin/groups")), []);
  const unfinished = invites.filter((invite) => inviteProgress(event, invite) !== "done");
  const question = event.questions.find((q) => q.id === questionId);
  const asked = question && onlyAnswered;
  const shown = sortInvites(onlyOpen ? unfinished : invites, order, event, i18n.language).filter(
    (invite) => !asked || invite.persons.some((person) => hasAnswer(person, question.id)),
  );
  // As the backend decides for guests: the deadline, or the start without one (D12).
  const answersCloseAt = event.rsvp_deadline ?? event.starts_at;
  const answersOpen = Date.now() < new Date(answersCloseAt).getTime();
  const persons = invites.flatMap((invite) => invite.persons);

  function showInInvites(id: string) {
    setQuestionId(id);
    document.getElementById("invites")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="row title-row">
        <a
          className="icon back"
          href="/"
          aria-label={t("admin.event.back")}
          title={t("admin.event.back")}
        >
          <Icon name="back" />
        </a>
        <h1>{event.title}</h1>
        <span className="heading-actions">
          <a
            className="icon"
            href={`/admin/events/${event.id}/preview`}
            aria-label={t("admin.event.preview")}
            title={t("admin.event.preview")}
          >
            {/* Like an invite's link, but for the event without a guest of its own. */}
            <Icon name="open" />
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
      <EventWhenWhere event={event} />
      {event.description && <ExpandableText text={event.description} />}

      <AttendanceCounts counts={countAttendance(persons)} />

      <QuestionAnswers event={event} persons={persons} onShow={showInInvites} />

      <div
        className="row"
        id="invites"
        style={{ scrollMarginTop: "calc(var(--topbar-height) + 1rem)" }}
      >
        <h2>
          {t("admin.event.invites")} <InfoTip text={t("admin.event.invitesHint")} />
        </h2>
        <span className="heading-actions">
          {invites.length > 1 && (
            <SortMenu
              label={t("admin.event.sort")}
              value={order}
              onChange={setOrder}
              options={INVITE_ORDERS.map((value) => ({
                value,
                label: t(`admin.event.order.${value}`),
                group: value.split("-")[0]!,
              }))}
            />
          )}
          {invites.length > 0 && event.questions.length > 0 && (
            <SortMenu
              label={t("admin.event.byQuestion")}
              icon="ask"
              active={question !== undefined}
              value={questionId}
              onChange={setQuestionId}
              options={[
                { value: ALL_QUESTIONS, label: t("admin.event.allQuestions"), group: "all" },
                ...event.questions.map((q) => ({ value: q.id, label: q.label, group: "questions" })),
              ]}
            />
          )}
          {question && (
            <button
              type="button"
              className="icon ghost toggle"
              aria-pressed={onlyAnswered}
              aria-label={t("admin.event.onlyAnswered")}
              title={t("admin.event.onlyAnswered")}
              onClick={() => setOnlyAnswered(!onlyAnswered)}
            >
              <Icon name="check" />
            </button>
          )}
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
      {/* Where the deadline matters: who still has to answer, and until when. */}
      <p className="muted">
        {t(answersOpen ? "admin.event.answersUntil" : "admin.event.answersClosed", {
          date: formatDateTime(answersCloseAt, i18n.language),
        })}
      </p>
      {invites.length === 0 && <p className="muted">{t("admin.event.noInvites")}</p>}
      {onlyOpen && unfinished.length === 0 && invites.length > 0 && (
        <p className="muted">{t("admin.event.allFinished")}</p>
      )}
      {adding && (
        <NewInvite
          kind={adding}
          event={event}
          invites={invites}
          groups={groups.data ?? []}
          // Newest first, as the host's list is; invites made together go by name.
          onCreated={(created) =>
            onChange([...[...created].sort((a, b) => a.name.localeCompare(b.name)), ...invites])
          }
          onClose={() => setAdding(undefined)}
        />
      )}
      <ul className="cards">
        {shown.map((invite) => (
          <InviteCard
            key={invite.id}
            event={event}
            invite={invite}
            question={question}
            onlyAnswered={onlyAnswered}
            onDeleted={() => onChange(invites.filter((i) => i.id !== invite.id))}
          />
        ))}
      </ul>
    </>
  );
}

function InviteCard({
  event,
  invite,
  question,
  onlyAnswered,
  onDeleted,
}: {
  event: Event;
  invite: Invite;
  /** Show only this question's answers; all of them without. */
  question?: Event["questions"][number];
  /** With a question: leave out the people who gave no answer to it. */
  onlyAnswered: boolean;
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
  const mark = useProgressMark();
  const progress = inviteProgress(event, invite);
  const progressLabel = t(`admin.event.progress.${progress}`);
  const progressIcon = mark !== "bar" && (
    <span className="progress-icon" role="img" aria-label={progressLabel} title={progressLabel}>
      <Icon name={PROGRESS_ICONS[progress]} />
    </span>
  );
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
  const answersLine = (person: Person) =>
    summary(question ? [question] : event.questions, person.answers, !question);
  const persons = (
    <ul className="persons">
      {sortedByName(invite.persons, i18n.language)
        .filter((person) => !question || !onlyAnswered || hasAnswer(person, question.id))
        .map((person) => {
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
              {answersLine(person) && <span className="muted"> · {answersLine(person)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <li className={`card progress ${progress}${mark === "icon" ? "" : " bar"}`}>
      {single ? (
        <div className="row single">
          {progressIcon}
          {persons}
          {actions}
        </div>
      ) : (
        <div className="row">
          <span className="invite-title">
            {progressIcon}
            <strong>{invite.name}</strong>
          </span>
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

const PROGRESS_ICONS = {
  open: "progressOpen",
  partial: "progressPartial",
  done: "progressDone",
} as const satisfies Record<Progress, IconName>;

/** The orders the invites can be listed in: each kind of sorting either way. The list from the
 * server, and the page's own, is newest first. */
const INVITE_ORDERS = [
  "name-asc",
  "name-desc",
  "added-desc",
  "added-asc",
  "status-asc",
  "status-desc",
  "people-desc",
  "people-asc",
] as const;
type InviteOrder = (typeof INVITE_ORDERS)[number];

/** Equal ones keep the order they come in, newest first. */
function sortInvites(invites: Invite[], order: InviteOrder, event: Event, language: string): Invite[] {
  if (order === "added-desc") return invites;
  if (order === "added-asc") return [...invites].reverse();
  const collator = nameCollator(language);
  const rank = { open: 0, partial: 1, done: 2 } satisfies Record<Progress, number>;
  const [kind, direction] = order.split("-");
  const sign = direction === "asc" ? 1 : -1;
  return [...invites].sort(
    (a, b) =>
      sign *
      (kind === "name"
        ? collator.compare(a.name, b.name)
        : kind === "status"
          ? rank[inviteProgress(event, a)] - rank[inviteProgress(event, b)]
          : a.persons.length - b.persons.length),
  );
}

/** Red while nobody answered, green once everyone is done, yellow in between. */
function inviteProgress(event: Event, invite: Invite): Progress {
  const all = invite.persons.map((person) => progressOf(event, person));
  if (all.every((progress) => progress === "open")) return "open";
  if (all.every((progress) => progress === "done")) return "done";
  return "partial";
}
