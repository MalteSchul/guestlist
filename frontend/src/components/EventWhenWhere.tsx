import { useTranslation } from "react-i18next";

import { formatDateRange } from "../i18n/text";

/** When and where, under an event's title: the same lines for guests (the invitation, its
 * preview) and for hosts (the overview, the edit page). */
export function EventWhenWhere({
  event,
}: {
  event: { starts_at: string; ends_at?: string | null; location?: string | null };
}) {
  const { i18n } = useTranslation();
  return (
    <>
      <p className="meta">{formatDateRange(event.starts_at, event.ends_at, i18n.language)}</p>
      {event.location && (
        <p className="meta">
          <a href={mapsUrl(event.location)} target="_blank" rel="noreferrer">
            {event.location}
          </a>
        </p>
      )}
    </>
  );
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
