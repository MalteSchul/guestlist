import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Layout } from "../../components/Layout";
import { EventForm } from "./EventForm";

export function NewEvent() {
  const { t } = useTranslation();

  // Straight on to the questions; the creator is the event's owner.
  async function create(body: Schemas["EventIn"]) {
    const event = await unwrap(api.POST("/api/admin/events", { body }));
    window.location.href = `/admin/events/${event.id}/edit`;
  }

  return (
    <Layout admin>
      <div className="row title-row">
        <a
          className="icon back"
          href="/"
          aria-label={t("admin.event.back")}
          title={t("admin.event.back")}
        >
          <Icon name="back" />
        </a>
        <h1>{t("admin.newEvent.title")}</h1>
      </div>
      <div className="card">
        <EventForm label={t("admin.newEvent.create")} onSubmit={create} />
      </div>
    </Layout>
  );
}
