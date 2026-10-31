import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { AttendanceCounts } from "../../components/AttendanceCounts";
import { Icon } from "../../components/Icon";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { useSave } from "./forms";

type Summary = Schemas["EventSummary"];

/** Over once it has ended, or started when it has no end. */
const isPast = (event: Summary) =>
  new Date(event.ends_at ?? event.starts_at).getTime() < Date.now();

export function EventList() {
  const { t } = useTranslation();
  const events = useLoad(() => unwrap(api.GET("/api/admin/events")), []);

  return (
    <Layout admin>
      <div className="row">
        <h1>{t("admin.events.title")}</h1>
        <a
          className="icon accent"
          href="/admin/events/new"
          aria-label={t("admin.events.new")}
          title={t("admin.events.new")}
        >
          <Icon name="plus" />
        </a>
      </div>
      <Loaded {...events}>
        {(events) => {
          // The next one first; past ones after them, most recent first (as the API sends them).
          const upcoming = events
            .filter((event) => !isPast(event))
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const past = events.filter(isPast);
          return events.length === 0 ? (
            <p className="muted">{t("admin.events.empty")}</p>
          ) : (
            <ul className="cards">
              {[...upcoming, ...past].map((event) => (
                <EventCard key={event.id} event={event} past={isPast(event)} />
              ))}
            </ul>
          );
        }}
      </Loaded>
    </Layout>
  );
}

function EventCard({ event, past }: { event: Summary; past: boolean }) {
  const { t, i18n } = useTranslation();
  const action = useSave();

  function duplicate() {
    void action.run(async () => {
      const copy = await unwrap(
        api.POST("/api/admin/events/{event_id}/duplicate", {
          params: { path: { event_id: event.id } },
        }),
      );
      // Straight to editing: a copy needs a new date at least.
      window.location.href = `/admin/events/${copy.id}/edit`;
    });
  }

  return (
    <li className={past ? "card event-card past" : "card event-card"}>
      <CalendarSheet iso={event.starts_at} language={i18n.language} />
      <div className="event-main">
        <a href={`/admin/events/${event.id}`}>
          <strong>{event.title}</strong>
        </a>
        <AttendanceCounts counts={event.attendance} />
        {action.error && <span className="error">{action.error}</span>}
      </div>
      <span className="card-actions">
        <button
          type="button"
          className="icon ghost"
          aria-label={t("admin.events.duplicate")}
          title={t("admin.events.duplicate")}
          disabled={action.status === "saving"}
          onClick={duplicate}
        >
          <Icon name="duplicate" />
        </button>
      </span>
    </li>
  );
}

/** Month and day on a small calendar sheet; screen readers get the full date. */
function CalendarSheet({ iso, language }: { iso: string; language: string }) {
  const date = new Date(iso);
  return (
    <span
      className="calendar"
      role="img"
      aria-label={new Intl.DateTimeFormat(language, { dateStyle: "full" }).format(date)}
    >
      <span className="month" aria-hidden="true">
        {new Intl.DateTimeFormat(language, { month: "short" }).format(date)}
      </span>
      <span className="day" aria-hidden="true">
        {date.getDate()}
      </span>
    </span>
  );
}
