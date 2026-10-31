import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { Icon } from "../../components/Icon";
import { formatDateTime } from "../../i18n/text";

/** The event's settings, read-only, one line each with its icon: until when guests can answer,
 * whether the data is kept, whether guests see who's coming. On the edit page until the pencil
 * opens the form. */
export function EventSettings({ event }: { event: Schemas["EventOut"] }) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <p className="setting">
        <Icon name="hourglass" />
        {event.rsvp_deadline
          ? t("admin.details.answersUntil", {
              date: formatDateTime(event.rsvp_deadline, i18n.language),
            })
          : t("admin.details.answersUntilStart")}
      </p>
      <p className="setting">
        <Icon name={event.keep_data ? "archive" : "delete"} />
        {event.keep_data ? t("admin.details.kept") : t("admin.details.deleted")}
      </p>
      <p className="setting">
        <Icon name={event.guest_list_enabled ? "show" : "hide"} />
        {event.guest_list_enabled ? t("admin.details.guestList") : t("admin.details.noGuestList")}
      </p>
    </>
  );
}
