import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Layout } from "../../components/Layout";
import { EventForm } from "./EventForm";

export function NewEvent() {
  const { t } = useTranslation();

  // Straight on to sections and questions; the creator is the event's owner.
  async function create(body: Schemas["EventIn"]) {
    const event = await unwrap(api.POST("/api/admin/events", { body }));
    window.location.href = `/admin/events/${event.id}/edit`;
  }

  return (
    <Layout admin>
      <p>
        <a href="/">← {t("admin.event.back")}</a>
      </p>
      <h1>{t("admin.newEvent.title")}</h1>
      <div className="card">
        <EventForm label={t("admin.newEvent.create")} onSubmit={create} />
      </div>
    </Layout>
  );
}
