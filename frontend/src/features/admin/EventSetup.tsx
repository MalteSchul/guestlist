import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { EventWhenWhere } from "../../components/EventWhenWhere";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { EventForm } from "./EventForm";
import { EventSettings } from "./EventSettings";
import { IconButton, useSave } from "./forms";
import { Questions } from "./Questions";

type Event = Schemas["EventOut"];

/** Where hosts set an event up: the invitation, the questions, the settings. */
export function EventSetup({ eventId }: { eventId: string }) {
  const params = { path: { event_id: eventId } };
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);

  // After every change, so the page always shows what the backend stored.
  async function reload() {
    event.setData(await unwrap(api.GET("/api/admin/events/{event_id}", { params })));
  }

  return (
    <Layout admin>
      <Loaded {...event}>{(event) => <Setup event={event} reload={reload} />}</Loaded>
    </Layout>
  );
}

function Setup({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t } = useTranslation();
  const params = { path: { event_id: event.id } };
  // Each part opens on its own; saving one never touches the other (EventForm's `fields`).
  const [editingInvitation, setEditingInvitation] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  async function update(body: Schemas["EventIn"]) {
    await unwrap(api.PUT("/api/admin/events/{event_id}", { params, body }));
    await reload();
  }

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
        <h1>{t("admin.setup.title", { title: event.title })}</h1>
      </div>

      {/* In the order guests read it: the invitation, then the questions. Each part
          is read-only until its pencil opens the form in its place. */}
      <div className="row">
        <h2>{t("admin.setup.invitation")}</h2>
        {!editingInvitation && (
          <IconButton
            icon="edit"
            label={t("admin.setup.editInvitation")}
            onClick={() => setEditingInvitation(true)}
          />
        )}
      </div>
      {editingInvitation ? (
        <div className="card">
          <EventForm
            event={event}
            fields="invitation"
            onSubmit={async (body) => {
              await update(body);
              setEditingInvitation(false);
            }}
            onCancel={() => setEditingInvitation(false)}
          />
        </div>
      ) : (
        // As on the guest page; the title is this page's heading.
        <>
          <EventWhenWhere event={event} />
          {event.description && <p className="prose">{event.description}</p>}
        </>
      )}

      <Questions event={event} reload={reload} />

      <div className="row">
        <h2>{t("admin.setup.settings")}</h2>
        {!editingSettings && (
          <IconButton
            icon="edit"
            label={t("admin.setup.editSettings")}
            onClick={() => setEditingSettings(true)}
          />
        )}
      </div>
      <div className="card">
        {editingSettings ? (
          <EventForm
            event={event}
            fields="settings"
            onSubmit={async (body) => {
              await update(body);
              setEditingSettings(false);
            }}
            onCancel={() => setEditingSettings(false)}
          />
        ) : (
          <EventSettings event={event} />
        )}
      </div>

      <DeleteEvent event={event} />
    </>
  );
}

/** Only owners may; the backend says so if someone else tries. */
function DeleteEvent({ event }: { event: Event }) {
  const { t } = useTranslation();
  const action = useSave();

  function remove() {
    const title = event.title;
    if (!window.confirm(t("admin.setup.confirmDeleteEvent", { title }))) return;
    void action.run(async () => {
      await unwrap(api.DELETE("/api/admin/events/{event_id}", { params: { path: { event_id: event.id } } }));
      window.location.href = "/";
    });
  }

  return (
    <>
      <h2>{t("admin.setup.deleteEvent")}</h2>
      <div className="card">
        <p className="muted">{t("admin.setup.deleteEventHint")}</p>
        <div className="actions">
          <button
            type="button"
            className="danger"
            disabled={action.status === "saving"}
            onClick={remove}
          >
            {t("admin.setup.deleteEvent")}
          </button>
          {action.error && <span className="error">{action.error}</span>}
        </div>
      </div>
    </>
  );
}
