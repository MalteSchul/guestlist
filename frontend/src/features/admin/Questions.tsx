import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import {
  IconButton,
  ItemControls,
  moved,
  nextPosition,
  SaveBar,
  TextField,
  useSave,
} from "./forms";
import { InfoTip } from "../../components/InfoTip";
import { useLoad } from "../../components/useLoad";
import { useReveal } from "../../components/useReveal";

type Event = Schemas["EventOut"];
type Question = Schemas["QuestionOut"];
type Option = Schemas["OptionOut"];
/** What hosts pick from; stored as `kind` plus `multiple`. */
const KINDS = ["single", "multiple", "text"] as const;
type Kind = (typeof KINDS)[number];

export function Questions({ event, reload }: { event: Event; reload: () => Promise<void> }) {
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a question's ID
  const [adding, setAdding] = useState(false);
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
    const label = question.label;
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
      <div className="row">
        <h2>
          {t("admin.setup.questions")} <InfoTip text={t("admin.setup.questionsHint")} />
        </h2>
        {!adding && (
          <IconButton
            icon="plus"
            label={t("admin.setup.addQuestion")}
            accent
            onClick={() => setAdding(true)}
          />
        )}
      </div>
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
                <strong>{question.label}</strong>
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
      {adding && <NewQuestion event={event} reload={reload} onDone={() => setAdding(false)} />}
    </>
  );
}

function QuestionSummary({ question }: { question: Question }) {
  const { t } = useTranslation();
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
                option.label +
                (option.active ? "" : ` (${t("admin.setup.hidden")})`),
            )
            .join(" · ")}
        </p>
      )}
    </>
  );
}

function kindOf(question: Pick<Question, "kind" | "multiple">): Kind {
  if (question.kind === "text") return "text";
  return question.multiple ? "multiple" : "single";
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
  const reveal = useReveal<HTMLLIElement>();
  const [label, setLabel] = useState(question.label ?? "");
  const [required, setRequired] = useState(question.required);
  const askedAgain = useAskedAgain(event, required && !question.required ? question.id : undefined);

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await unwrap(
        api.PUT("/api/admin/events/{event_id}/questions/{question_id}", {
          params: { path: { event_id: event.id, question_id: question.id } },
          body: { ...questionUpdate(question), label: label, required },
        }),
      );
      await reload();
    });
  }

  return (
    <li className="card" ref={reveal}>
      <form onSubmit={submit} onChange={save.reset}>
        <TextField
          label={t("admin.setup.question")}
          value={label}
          onChange={setLabel}
          required
        />
        <RequiredField value={required} onChange={setRequired} askedAgain={askedAgain} />
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

function RequiredField({
  value,
  onChange,
  askedAgain = 0,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  /** People who already said yes without answering it: they'll be asked again. */
  askedAgain?: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label className="choice">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {t("admin.setup.required")}
      </label>
      <span className="hint">{t("admin.setup.requiredHint")}</span>
      {askedAgain > 0 && (
        <span className="hint missing">{t("admin.setup.askedAgain", { count: askedAgain })}</span>
      )}
    </div>
  );
}

/** How many people said yes but haven't answered this question, which a new required question
 * or one made required would ask them again (D27). `"new"` for a question not saved yet;
 * undefined when nothing becomes required. */
function useAskedAgain(event: Event, question: string | undefined): number {
  const invites = useLoad(
    () =>
      unwrap(
        api.GET("/api/admin/events/{event_id}/invites", {
          params: { path: { event_id: event.id } },
        }),
      ),
    [event.id],
  );
  if (!question) return 0;
  return (invites.data ?? [])
    .flatMap((invite) => invite.persons)
    .filter(
      (person) =>
        person.attendance === "yes" &&
        !person.answers.some(
          (a) => a.question_id === question && (a.option_ids.length > 0 || a.text_value),
        ),
    ).length;
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
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // an option's ID
  const [adding, setAdding] = useState(false);
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
    const label = option.label;
    if (!window.confirm(t("admin.setup.confirmDeleteOption", { label }))) return;
    run(() =>
      unwrap(
        api.DELETE("/api/admin/events/{event_id}/questions/{question_id}/options/{option_id}", {
          params: params(option.id),
        }),
      ),
    );
  }

  async function add(label: string) {
    await unwrap(
      api.POST("/api/admin/events/{event_id}/questions/{question_id}/options", {
        params: { path: { event_id: event.id, question_id: question.id } },
        body: { label, active: true, position: nextPosition(options) },
      }),
    );
    await reload();
    setAdding(false);
  }

  async function change(option: Option, label: string) {
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
                onSubmit={(label) => change(option, label)}
                onCancel={() => setEditing(undefined)}
              />
            </li>
          ) : (
            <li key={option.id} className="row">
              <span className={option.active ? undefined : "muted"}>
                {option.label}
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
                <IconButton
                  icon={option.active ? "hide" : "show"}
                  label={option.active ? t("admin.setup.hide") : t("admin.setup.show")}
                  disabled={action.status === "saving"}
                  onClick={() => run(() => put({ ...option, active: !option.active }))}
                />
              </ItemControls>
            </li>
          ),
        )}
      </ul>
      {adding ? (
        <OptionForm onSubmit={add} onCancel={() => setAdding(false)} />
      ) : (
        <p>
          <button type="button" onClick={() => setAdding(true)}>
            + {t("admin.setup.addOption")}
          </button>
        </p>
      )}
    </fieldset>
  );
}

function OptionForm({
  option,
  onSubmit,
  onCancel,
}: {
  option?: Option;
  onSubmit: (label: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const reveal = useReveal<HTMLFormElement>();
  const [label, setLabel] = useState(option?.label ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSubmit(label));
  }

  return (
    <form onSubmit={submit} onChange={save.reset} className="nested" ref={reveal}>
      <TextField
        label={t("admin.setup.option")}
        value={label}
        onChange={setLabel}
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
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Kind>("single");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const askedAgain = useAskedAgain(event, required ? "new" : undefined);
  // Grows with the option rows of a choice question.
  const reveal = useReveal<HTMLFormElement>();

  function submit(e: FormEvent) {
    e.preventDefault();
    // Empty option rows are left out; a choice question without any gets the backend's message.
    const labels = kind !== "text" ? options.map((o) => o.trim()).filter(Boolean) : [];
    void save.run(async () => {
      await unwrap(
        api.POST("/api/admin/events/{event_id}/questions", {
          params: { path: { event_id: event.id } },
          body: {
            label: label,
            kind: kind === "text" ? "text" : "choice",
            multiple: kind === "multiple",
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
    <form onSubmit={submit} onChange={save.reset} className="card" ref={reveal}>
      <TextField
        label={t("admin.setup.question")}
        value={label}
        onChange={setLabel}
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
        </div>
        <span className="hint">{t("admin.setup.kindFixed")}</span>
      </fieldset>

      <RequiredField value={required} onChange={setRequired} askedAgain={askedAgain} />

      {kind !== "text" && (
        <fieldset className="field plain">
          <legend>{t("admin.setup.options")}</legend>
          {options.map((option, index) => (
            <div key={index} className="nested option-row">
              <TextField
                label={t("admin.setup.optionNumber", { number: index + 1 })}
                value={option}
                onChange={(value) =>
                  setOptions((all) => all.map((o, i) => (i === index ? value : o)))
                }
              />
              {options.length > 1 && (
                <IconButton
                  icon="delete"
                  label={t("common.remove")}
                  danger
                  onClick={() => setOptions((all) => all.filter((_, i) => i !== index))}
                />
              )}
            </div>
          ))}
          <p>
            <button type="button" onClick={() => setOptions((all) => [...all, ""])}>
              + {t("admin.setup.addOption")}
            </button>
          </p>
        </fieldset>
      )}

      <SaveBar save={save} label={t("admin.setup.addQuestion")} onCancel={onDone} />
    </form>
  );
}
