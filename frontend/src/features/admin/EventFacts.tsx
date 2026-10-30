import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { Icon } from "../../components/Icon";
import { formatDateRange, formatDateTime } from "../../i18n/text";

/** What hosts set in the event form, read-only and compact: on the event's page under its title,
 * and on the setup page in place of the form until the pencil opens it. The title is left out;
 * both pages have it as their heading. */
export function EventFacts({ event }: { event: Schemas["EventOut"] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="event-facts">
      <p className="meta">
        <Icon name="clock" />
        {formatDateRange(event.starts_at, event.ends_at, lang)}
      </p>
      {event.location && (
        <p className="meta">
          <Icon name="pin" />
          {event.location}
        </p>
      )}
      <p className="meta">
        <Icon name="hourglass" />
        {event.rsvp_deadline
          ? t("admin.details.answersUntil", { date: formatDateTime(event.rsvp_deadline, lang) })
          : t("admin.details.answersUntilStart")}
      </p>
      <p className="meta settings">
        <span>
          <Icon name={event.keep_data ? "archive" : "delete"} />
          {event.keep_data ? t("admin.details.kept") : t("admin.details.deleted")}
        </span>
        <span>
          <Icon name={event.guest_list_enabled ? "show" : "hide"} />
          {event.guest_list_enabled ? t("admin.details.guestList") : t("admin.details.noGuestList")}
        </span>
      </p>
      {event.description && <p className="prose muted clamp">{event.description}</p>}
    </div>
  );
}
