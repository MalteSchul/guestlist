import { useTranslation } from "react-i18next";

import { api, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime, pick } from "../../i18n/text";

export function EventList() {
  const { t, i18n } = useTranslation();
  const events = useLoad(() => unwrap(api.GET("/api/admin/events")), []);

  return (
    <Layout>
      <h1>{t("admin.events.title")}</h1>
      <Loaded {...events}>
        {(events) =>
          events.length === 0 ? (
            <>
              <p className="muted">{t("admin.events.empty")}</p>
              {import.meta.env.DEV && (
                <p className="muted">
                  {t("admin.events.devHint")} <a href="/docs">/docs</a>
                </p>
              )}
            </>
          ) : (
            <ul className="cards">
              {events.map((event) => (
                <li key={event.id} className="card">
                  <a href={`/admin/events/${event.id}`}>
                    <strong>{pick(event.title, i18n.language)}</strong>
                  </a>
                  <span className="muted">{formatDateTime(event.starts_at, i18n.language)}</span>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </Layout>
  );
}
