import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import type { Language } from "../../i18n";
import { pick } from "../../i18n/text";
import { EventForm } from "./EventForm";
import {
  ItemControls,
  LanguageTabs,
  moved,
  nextPosition,
  requiredText,
  SaveBar,
  textDraft,
  TranslatedField,
  useSave,
} from "./forms";
import { Questions } from "./Questions";

type Event = Schemas["EventOut"];
type Section = Schemas["SectionOut"];

/** Where hosts set an event up: its details, the information guests see, the questions. */
export function EventSetup({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const params = { path: { event_id: eventId } };
  const event = useLoad(() => unwrap(api.GET("/api/admin/events/{event_id}", { params })), [eventId]);

  // After every change, so the page always shows what the backend stored.
  async function reload() {
    event.setData(await unwrap(api.GET("/api/admin/events/{event_id}", { params })));
  }

  return (
    <Layout>
      <p>
        <a href={`/admin/events/${eventId}`}>← {t("admin.setup.back")}</a>
      </p>
      <Loaded {...event}>{(event) => <Setup event={event} reload={reload} />}</Loaded>
    </Layout>
  );
}

function Setup({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const params = { path: { event_id: event.id } };

  async function update(body: Schemas["EventIn"]) {
    await unwrap(api.PUT("/api/admin/events/{event_id}", { params, body }));
    await reload();
  }

  return (
    <>
      <h1>{t("admin.setup.title", { title: pick(event.title, i18n.language) })}</h1>

      <LanguageTabs
        initial={event.default_language}
        missing={{ de: missing(event, "de"), en: missing(event, "en") }}
      >
        <h2>{t("admin.setup.details")}</h2>
        <div className="card">
          <EventForm event={event} onSubmit={update} />
        </div>

        <Sections event={event} reload={reload} />
        <Questions event={event} reload={reload} />
      </LanguageTabs>
      <DeleteEvent event={event} />
    </>
  );
}

/** Texts guests see that lack this language; the same ones the guest API checks for its
 * complete `languages` (A21). */
function missing(event: Event, language: Language): number {
  const texts = [
    event.title,
    event.description,
    ...event.sections.flatMap((section) => [section.title, section.body]),
    ...event.questions.flatMap((question) => [
      question.label,
      ...question.options.filter((option) => option.active).map((option) => option.label),
    ]),
  ];
  return texts.filter((text) => text && !text[language]).length;
}

function Sections({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
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
    const title = pick(section.title, i18n.language);
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
      <h2>{t("admin.setup.sections")}</h2>
      <p className="muted">{t("admin.setup.sectionsHint")}</p>
      {action.error && <p className="error">{action.error}</p>}
      <ul className="cards">
        {sections.map((section, index) =>
          editing === section.id ? (
            <li key={section.id} className="card">
              <SectionForm
                section={section}
                language={event.default_language}
                onSubmit={(text) => change(section, text)}
                onCancel={() => setEditing(undefined)}
              />
            </li>
          ) : (
            <li key={section.id} className="card">
              <div className="row">
                <strong>{pick(section.title, i18n.language)}</strong>
                <ItemControls
                  index={index}
                  count={sections.length}
                  busy={action.status === "saving"}
                  onMove={(by) => move(index, by)}
                  onEdit={() => setEditing(section.id)}
                  onDelete={() => remove(section)}
                />
              </div>
              <p className="prose muted clamp">{pick(section.body, i18n.language)}</p>
            </li>
          ),
        )}
      </ul>
      {adding ? (
        <div className="card">
          <SectionForm
            language={event.default_language}
            onSubmit={add}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <p>
          <button type="button" onClick={() => setAdding(true)}>
            + {t("admin.setup.addSection")}
          </button>
        </p>
      )}
    </>
  );
}

type SectionText = Pick<Section, "title" | "body">;

function SectionForm({
  section,
  language,
  onSubmit,
  onCancel,
}: {
  section?: Section;
  language: Language;
  onSubmit: (text: SectionText) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [title, setTitle] = useState(textDraft(section?.title));
  const [body, setBody] = useState(textDraft(section?.body));

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSubmit({ title: requiredText(title), body: requiredText(body) }));
  }

  return (
    <form onSubmit={submit} onChange={save.reset}>
      <TranslatedField
        label={t("admin.setup.sectionTitle")}
        value={title}
        onChange={setTitle}
        language={language}
        required
      />
      <TranslatedField
        label={t("admin.setup.sectionBody")}
        value={body}
        onChange={setBody}
        language={language}
        required
        multiline
      />
      <SaveBar save={save} onCancel={onCancel} />
    </form>
  );
}

/** Only owners may; the backend says so if someone else tries. */
function DeleteEvent({ event }: { event: Event }) {
  const { t, i18n } = useTranslation();
  const action = useSave();

  function remove() {
    const title = pick(event.title, i18n.language);
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
