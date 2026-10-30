import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { EventForm } from "./EventForm";
import {
  IconButton,
  ItemControls,
  moved,
  nextPosition,
  SaveBar,
  TextField,
  useSave,
} from "./forms";
import { Questions } from "./Questions";
import { useReveal } from "../../components/useReveal";

type Event = Schemas["EventOut"];
type Section = Schemas["SectionOut"];

/** Where hosts set an event up: its details, the information guests see, the questions. */
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

        <h2>{t("admin.setup.details")}</h2>
        <div className="card">
          <EventForm event={event} onSubmit={update} />
        </div>

        <Sections event={event} reload={reload} />
        <Questions event={event} reload={reload} />
      <DeleteEvent event={event} />
    </>
  );
}

function Sections({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t } = useTranslation();
  const action = useSave();
  // Adding is its own state, so opening a new form never closes (and loses) an open editor.
  const [editing, setEditing] = useState<string>(); // a section's ID
  const [adding, setAdding] = useState(false);
  const { sections } = event;
  const params = (sectionId: string) => ({
    path: { event_id: event.id, section_id: sectionId },
  });

  const put = (section: Section) =>
    unwrap(
      api.PUT("/api/admin/events/{event_id}/sections/{section_id}", {
        params: params(section.id),
        body: { title: section.title, body: section.body, position: section.position },
      }),
    );

  const move = (index: number, by: -1 | 1) =>
    void action.run(async () => {
      for (const section of moved(sections, index, by)) await put(section);
      await reload();
    });

  function remove(section: Section) {
    const title = section.title;
    if (!window.confirm(t("admin.setup.confirmDeleteSection", { title }))) return;
    void action.run(async () => {
      await unwrap(
        api.DELETE("/api/admin/events/{event_id}/sections/{section_id}", {
          params: params(section.id),
        }),
      );
      await reload();
    });
  }

  async function add(text: SectionText) {
    await unwrap(
      api.POST("/api/admin/events/{event_id}/sections", {
        params: { path: { event_id: event.id } },
        body: { ...text, position: nextPosition(sections) },
      }),
    );
    await reload();
    setAdding(false);
  }

  async function change(section: Section, text: SectionText) {
    await put({ ...section, ...text });
    await reload();
    setEditing(undefined);
  }

  return (
    <>
      <div className="row">
        <h2>{t("admin.setup.sections")}</h2>
        {!adding && (
          <IconButton
            icon="plus"
            label={t("admin.setup.addSection")}
            accent
            onClick={() => setAdding(true)}
          />
        )}
      </div>
      <p className="muted">{t("admin.setup.sectionsHint")}</p>
      {action.error && <p className="error">{action.error}</p>}
      <ul className="cards">
        {sections.map((section, index) =>
          editing === section.id ? (
            <li key={section.id} className="card">
              <SectionForm
                section={section}
                onSubmit={(text) => change(section, text)}
                onCancel={() => setEditing(undefined)}
              />
            </li>
          ) : (
            <li key={section.id} className="card">
              <div className="row">
                <strong>{section.title}</strong>
                <ItemControls
                  index={index}
                  count={sections.length}
                  busy={action.status === "saving"}
                  onMove={(by) => move(index, by)}
                  onEdit={() => setEditing(section.id)}
                  onDelete={() => remove(section)}
                />
              </div>
              <p className="prose muted clamp">{section.body}</p>
            </li>
          ),
        )}
      </ul>
      {adding && (
        <div className="card">
          <SectionForm onSubmit={add} onCancel={() => setAdding(false)} />
        </div>
      )}
    </>
  );
}

type SectionText = Pick<Section, "title" | "body">;

function SectionForm({
  section,
  onSubmit,
  onCancel,
}: {
  section?: Section;
  onSubmit: (text: SectionText) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const reveal = useReveal<HTMLFormElement>();
  const [title, setTitle] = useState(section?.title ?? "");
  const [body, setBody] = useState(section?.body ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSubmit({ title, body }));
  }

  return (
    <form onSubmit={submit} onChange={save.reset} ref={reveal}>
      <TextField
        label={t("admin.setup.sectionTitle")}
        value={title}
        onChange={setTitle}
        required
      />
      <TextField
        label={t("admin.setup.sectionBody")}
        value={body}
        onChange={setBody}
        required
        multiline
      />
      <SaveBar save={save} onCancel={onCancel} />
    </form>
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
