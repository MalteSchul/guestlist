import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { pick } from "../../i18n/text";
import {
  ItemControls,
  moved,
  nextPosition,
  requiredText,
  SaveBar,
  type TextDraft,
  textDraft,
  translated,
  TranslatedField,
  useSave,
} from "./forms";

type Event = Schemas["EventOut"];
type Question = Schemas["QuestionOut"];
type Option = Schemas["OptionOut"];
type Kind = Schemas["QuestionIn"]["kind"];

const KINDS: Kind[] = ["choice", "text"];

export function Questions({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a question's ID, or "new"
  const { questions } = event;
  const params = (questionId: string) => ({
    path: { event_id: event.id, question_id: questionId },
  });

  const move = (index: number, by: -1 | 1) =>
    void action.run(async () => {
      for (const question of moved(questions, index, by)) {
        await unwrap(
          api.PUT("/api/admin/events/{event_id}/questions/{question_id}", {
            params: params(question.id),
            body: questionUpdate(question),
          }),
        );
      }
      await reload();
    });

  function remove(question: Question) {
    const label = pick(question.label, i18n.language);
    if (!window.confirm(t("admin.setup.confirmDeleteQuestion", { label }))) return;
    void action.run(async () => {
      await unwrap(
        api.DELETE("/api/admin/events/{event_id}/questions/{question_id}", {
          params: params(question.id),
        }),
      );
      await reload();
    });
  }

  return (
    <>
      <h2>{t("admin.setup.questions")}</h2>
      <p className="muted">{t("admin.setup.questionsHint")}</p>
      {action.error && <p className="error">{action.error}</p>}
      <ul className="cards">
        {questions.map((question, index) =>
          editing === question.id ? (
            <QuestionEditor
              key={question.id}
              event={event}
              question={question}
              reload={reload}
              onDone={() => setEditing(undefined)}
            />
          ) : (
            <li key={question.id} className="card">
              <div className="row">
                <strong>{pick(question.label, i18n.language)}</strong>
                <ItemControls
                  index={index}
                  count={questions.length}
                  busy={action.status === "saving"}
                  onMove={(by) => move(index, by)}
                  onEdit={() => setEditing(question.id)}
                  onDelete={() => remove(question)}
                />
              </div>
              <QuestionSummary question={question} />
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <NewQuestion
          event={event}
          reload={reload}
          onDone={() => setEditing(undefined)}
        />
      ) : (
        <p>
          <button type="button" onClick={() => setEditing("new")}>
            + {t("admin.setup.addQuestion")}
          </button>
        </p>
      )}
    </>
  );
}

function QuestionSummary({ question }: { question: Question }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <p className="tally">
        <span className="badge">{t(`admin.setup.kinds.${kindOf(question)}`)}</span>
        {question.required && <span className="badge">{t("admin.setup.required")}</span>}
      </p>
      {question.kind === "choice" && (
        <p className="muted">
          {question.options
            .map(
              (option) =>
                pick(option.label, i18n.language) +
                (option.active ? "" : ` (${t("admin.setup.hidden")})`),
            )
            .join(" · ")}
        </p>
      )}
    </>
  );
}

function kindOf(question: Pick<Question, "kind" | "multiple">) {
  if (question.kind === "text") return "text";
  return question.multiple ? "choiceSeveral" : "choiceOne";
}

/** PUT takes the whole object, without the fields fixed at creation (D26). */
function questionUpdate(question: Question): Schemas["QuestionUpdate"] {
  return { label: question.label, required: question.required, position: question.position };
}

function QuestionEditor({
  event,
  question,
  reload,
  onDone,
}: {
  event: Event;
  question: Question;
  reload: () => Promise<void>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [label, setLabel] = useState(textDraft(question.label));
  const [required, setRequired] = useState(question.required);

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await unwrap(
        api.PUT("/api/admin/events/{event_id}/questions/{question_id}", {
          params: { path: { event_id: event.id, question_id: question.id } },
          body: { ...questionUpdate(question), label: requiredText(label), required },
        }),
      );
      await reload();
    });
  }

  return (
    <li className="card">
      <form onSubmit={submit} onChange={save.reset}>
        <TranslatedField
          label={t("admin.setup.question")}
          value={label}
          onChange={setLabel}
          language={event.default_language}
          required
        />
        <RequiredField value={required} onChange={setRequired} />
        <p className="hint">
          {t(`admin.setup.kinds.${kindOf(question)}`)} · {t("admin.setup.kindFixed")}
        </p>
        <SaveBar save={save} />
      </form>
      {question.kind === "choice" && <Options event={event} question={question} reload={reload} />}
      <div className="actions">
        <button type="button" onClick={onDone}>
          {t("admin.setup.done")}
        </button>
      </div>
    </li>
  );
}

function RequiredField({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label className="choice">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {t("admin.setup.required")}
      </label>
      <span className="hint">{t("admin.setup.requiredHint")}</span>
    </div>
  );
}

function Options({
  event,
  question,
  reload,
}: {
  event: Event;
  question: Question;
  reload: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // an option's ID, or "new"
  const { options } = question;
  const params = (optionId: string) => ({
    path: { event_id: event.id, question_id: question.id, option_id: optionId },
  });

  const put = (option: Option) =>
    unwrap(
      api.PUT("/api/admin/events/{event_id}/questions/{question_id}/options/{option_id}", {
        params: params(option.id),
        body: { label: option.label, active: option.active, position: option.position },
      }),
    );

  const run = (change: () => Promise<unknown>) =>
    void action.run(async () => {
      await change();
      await reload();
    });

  const move = (index: number, by: -1 | 1) =>
    run(async () => {
      for (const option of moved(options, index, by)) await put(option);
    });

  function remove(option: Option) {
    const label = pick(option.label, i18n.language);
    if (!window.confirm(t("admin.setup.confirmDeleteOption", { label }))) return;
    run(() =>
      unwrap(
        api.DELETE("/api/admin/events/{event_id}/questions/{question_id}/options/{option_id}", {
          params: params(option.id),
        }),
      ),
    );
  }

  async function add(label: Schemas["Translated"]) {
    await unwrap(
      api.POST("/api/admin/events/{event_id}/questions/{question_id}/options", {
        params: { path: { event_id: event.id, question_id: question.id } },
        body: { label, active: true, position: nextPosition(options) },
      }),
    );
    await reload();
    setEditing(undefined);
  }

  async function change(option: Option, label: Schemas["Translated"]) {
    await put({ ...option, label });
    await reload();
    setEditing(undefined);
  }

  return (
    <fieldset className="field plain">
      <legend>{t("admin.setup.options")}</legend>
      <span className="hint">{t("admin.setup.hiddenHint")}</span>
      {action.error && <p className="error">{action.error}</p>}
      <ul className="options">
        {options.map((option, index) =>
          editing === option.id ? (
            <li key={option.id}>
              <OptionForm
                option={option}
                event={event}
                onSubmit={(label) => change(option, label)}
                onCancel={() => setEditing(undefined)}
              />
            </li>
          ) : (
            <li key={option.id} className="row">
              <span className={option.active ? undefined : "muted"}>
                {pick(option.label, i18n.language)}
                {!option.active && ` (${t("admin.setup.hidden")})`}
              </span>
              <ItemControls
                index={index}
                count={options.length}
                busy={action.status === "saving"}
                onMove={(by) => move(index, by)}
                onEdit={() => setEditing(option.id)}
                onDelete={() => remove(option)}
              >
                <button
                  type="button"
                  disabled={action.status === "saving"}
                  onClick={() => run(() => put({ ...option, active: !option.active }))}
                >
                  {option.active ? t("admin.setup.hide") : t("admin.setup.show")}
                </button>
              </ItemControls>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <OptionForm event={event} onSubmit={add} onCancel={() => setEditing(undefined)} />
      ) : (
        <p>
          <button type="button" onClick={() => setEditing("new")}>
            + {t("admin.setup.addOption")}
          </button>
        </p>
      )}
    </fieldset>
  );
}

function OptionForm({
  option,
  event,
  onSubmit,
  onCancel,
}: {
  option?: Option;
  event: Event;
  onSubmit: (label: Schemas["Translated"]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [label, setLabel] = useState(textDraft(option?.label));

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSubmit(requiredText(label)));
  }

  return (
    <form onSubmit={submit} onChange={save.reset} className="nested">
      <TranslatedField
        label={t("admin.setup.option")}
        value={label}
        onChange={setLabel}
        language={event.default_language}
        required
      />
      <SaveBar save={save} onCancel={onCancel} />
    </form>
  );
}

function NewQuestion({
  event,
  reload,
  onDone,
}: {
  event: Event;
  reload: () => Promise<void>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [label, setLabel] = useState(textDraft(null));
  const [kind, setKind] = useState<Kind>("choice");
  const [multiple, setMultiple] = useState(false);
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<TextDraft[]>([textDraft(null), textDraft(null)]);

  function submit(e: FormEvent) {
    e.preventDefault();
    // Empty option rows are left out; a choice question without any gets the backend's message.
    const labels = kind === "choice" ? options.flatMap((o) => translated(o) ?? []) : [];
    void save.run(async () => {
      await unwrap(
        api.POST("/api/admin/events/{event_id}/questions", {
          params: { path: { event_id: event.id } },
          body: {
            label: requiredText(label),
            kind,
            multiple: kind === "choice" && multiple,
            required,
            position: nextPosition(event.questions),
            options: labels.map((label, position) => ({ label, active: true, position })),
          },
        }),
      );
      await reload();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} onChange={save.reset} className="card">
      <TranslatedField
        label={t("admin.setup.question")}
        value={label}
        onChange={setLabel}
        language={event.default_language}
        required
      />

      <fieldset className="field plain">
        <legend>{t("admin.setup.kind")}</legend>
        <div className="choices">
          {KINDS.map((k) => (
            <label key={k} className="choice">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
              {t(`admin.setup.kinds.${k}`)}
            </label>
          ))}
          {kind === "choice" && (
            <label className="choice">
              <input
                type="checkbox"
                checked={multiple}
                onChange={(e) => setMultiple(e.target.checked)}
              />
              {t("admin.setup.multiple")}
            </label>
          )}
        </div>
        <span className="hint">{t("admin.setup.kindFixed")}</span>
      </fieldset>

      <RequiredField value={required} onChange={setRequired} />

      {kind === "choice" && (
        <fieldset className="field plain">
          <legend>{t("admin.setup.options")}</legend>
          {options.map((option, index) => (
            <div key={index} className="nested">
              <TranslatedField
                label={t("admin.setup.optionNumber", { number: index + 1 })}
                value={option}
                onChange={(value) =>
                  setOptions((all) => all.map((o, i) => (i === index ? value : o)))
                }
                language={event.default_language}
              />
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOptions((all) => all.filter((_, i) => i !== index))}
                >
                  {t("common.remove")}
                </button>
              )}
            </div>
          ))}
          <p>
            <button type="button" onClick={() => setOptions((all) => [...all, textDraft(null)])}>
              + {t("admin.setup.addOption")}
            </button>
          </p>
        </fieldset>
      )}

      <SaveBar save={save} label={t("admin.setup.addQuestion")} onCancel={onDone} />
    </form>
  );
}
