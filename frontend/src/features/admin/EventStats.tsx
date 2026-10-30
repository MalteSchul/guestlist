import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime } from "../../i18n/text";
import { AgeChart, ageLabel } from "./charts/AgeChart";
import { AgeOptions, type Grouping, DEFAULT_GROUPING } from "./charts/AgeOptions";
import { AttendanceTimeline } from "./charts/AttendanceTimeline";
import { ChartCard, Legend, SERIES } from "./charts/ChartCard";

type Event = Schemas["EventOut"];
type Stats = Schemas["EventStats"];

/** What the answers add up to: how they came in over time, and how old the people coming are. */
export function EventStats({ eventId }: { eventId: string }) {
  const params = { path: { event_id: eventId } };
  const [grouping, setGrouping] = useState<Grouping>(DEFAULT_GROUPING);
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);
  // The old numbers stay on screen until the new ones are there.
  const stats = useLoad(
    () =>
      unwrap(
        api.GET("/api/admin/events/{event_id}/stats", {
          params: { ...params, query: { age_step: grouping.step, age_from: grouping.from } },
        }),
      ),
    [eventId, grouping.step, grouping.from],
  );

  return (
    <Layout admin>
      <Loaded {...event}>
        {(event) => (
          <Loaded {...stats}>
            {(stats) => (
              <Charts event={event} stats={stats} grouping={grouping} onGrouping={setGrouping} />
            )}
          </Loaded>
        )}
      </Loaded>
    </Layout>
  );
}

function Charts({
  event,
  stats,
  grouping,
  onGrouping,
}: {
  event: Event;
  stats: Stats;
  grouping: Grouping;
  onGrouping: (grouping: Grouping) => void;
}) {
  const { t, i18n } = useTranslation();
  const steps = stats.timeline;
  // Answers stop when the event or the RSVP deadline comes, so a past event ends there; one
  // that is still to come ends now.
  const closes = new Date(event.rsvp_deadline ?? event.starts_at).getTime();
  const lastStep = steps.length > 0 ? new Date(steps[steps.length - 1]!.at).getTime() : 0;
  const end = Math.max(lastStep, Math.min(Date.now(), closes));
  const coming = stats.ages.reduce((sum, band) => sum + band.yes + band.maybe, 0);

  return (
    <>
      <div className="row title-row">
        <a
          className="icon back"
          href={`/admin/events/${event.id}`}
          aria-label={t("admin.setup.back")}
          title={t("admin.setup.back")}
        >
          <Icon name="back" />
        </a>
        <h1>{event.title}</h1>
      </div>
      <p className="meta">{formatDateTime(event.starts_at, i18n.language)}</p>

      {steps.length === 0 ? (
        <p className="muted">{t("admin.stats.noInvites")}</p>
      ) : (
        <>
          <ChartCard
            title={t("admin.stats.timeline")}
            hint={t("admin.stats.timelineHint")}
            legend={<Legend items={SERIES} />}
            table={<TimelineTable steps={steps} />}
          >
            <AttendanceTimeline steps={steps} end={end} />
          </ChartCard>
          <ChartCard
            title={t("admin.stats.ages")}
            hint={t("admin.stats.agesHint")}
            options={{
              label: t("admin.stats.groups"),
              controls: <AgeOptions grouping={grouping} onChange={onGrouping} />,
            }}
            legend={<Legend items={["yes", "maybe"]} />}
            table={<AgeTable stats={stats} />}
            note={
              stats.age_unknown > 0
                ? t("admin.stats.ageUnknown", { count: stats.age_unknown })
                : undefined
            }
          >
            {coming > 0 ? (
              <AgeChart bands={stats.ages} />
            ) : (
              <div className="chart-empty">
                <p className="muted">{t("admin.stats.noAges")}</p>
                <p className="hint">{t("admin.stats.noAgesHint")}</p>
              </div>
            )}
          </ChartCard>
        </>
      )}
    </>
  );
}

/** The same numbers as the timeline, newest first. */
function TimelineTable({ steps }: { steps: Stats["timeline"] }) {
  const { t, i18n } = useTranslation();
  const moment = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="chart-table-wrap scroll">
      <table className="chart-table">
        <thead>
          <tr>
            <th>{t("admin.stats.time")}</th>
            {SERIES.map((key) => (
              <th key={key}>{t(`admin.attendance.${key}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...steps].reverse().map((step) => (
            <tr key={step.at}>
              <th scope="row">{moment.format(new Date(step.at))}</th>
              {SERIES.map((key) => (
                <td key={key}>{step[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The same numbers as the age chart, with those whose age isn't known. */
function AgeTable({ stats }: { stats: Stats }) {
  const { t } = useTranslation();
  return (
    <div className="chart-table-wrap scroll">
      <table className="chart-table">
        <thead>
          <tr>
            <th>{t("admin.stats.age")}</th>
            <th>{t("admin.attendance.yes")}</th>
            <th>{t("admin.attendance.maybe")}</th>
            <th>{t("admin.stats.total")}</th>
          </tr>
        </thead>
        <tbody>
          {stats.ages.map((band) => (
            <tr key={band.min_age}>
              <th scope="row">{ageLabel(band)}</th>
              <td>{band.yes}</td>
              <td>{band.maybe}</td>
              <td>{band.yes + band.maybe}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{t("admin.stats.unknown")}</th>
            <td colSpan={3}>{stats.age_unknown}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
