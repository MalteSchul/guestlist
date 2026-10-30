import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/client";
import { AttendanceIcon } from "../../components/AttendanceIcon";
import { Icon } from "../../components/Icon";
import { InfoTip } from "../../components/InfoTip";
import { sortedByName } from "../../i18n/text";
import { KindIcon, kindOf } from "./Questions";

type Event = Schemas["EventOut"];
type Person = Schemas["PersonOut"];
type Question = Schemas["QuestionOut"];

/** What guests answered, question by question: the counts for a choice, and for free text every
 * answer with the name. Those who are coming count; a switch adds those who said "maybe".
 * `onShow` takes the host to the invites, narrowed to that question. */
export function QuestionAnswers({
  event,
  persons,
  onShow,
}: {
  event: Event;
  persons: Person[];
  onShow: (questionId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [withMaybe, setWithMaybe] = useState(false);
  if (event.questions.length === 0) return null;

  const counted = persons.filter(
    (person) => person.attendance === "yes" || (withMaybe && person.attendance === "maybe"),
  );

  return (
    <>
      <div className="row">
        <h2>
          {t("admin.event.totals")} <InfoTip text={t("admin.event.totalsHint")} />
        </h2>
        <span className="heading-actions">
          <button
            type="button"
            className="icon ghost toggle"
            aria-pressed={withMaybe}
            aria-label={t("admin.event.withMaybe")}
            title={t("admin.event.withMaybe")}
            onClick={() => setWithMaybe(!withMaybe)}
          >
            <AttendanceIcon attendance="maybe" />
          </button>
        </span>
      </div>
      {event.questions.map((question) => (
        <div key={question.id} className="card">
          <div className="row">
            <span className="question-name">
              <KindIcon kind={kindOf(question)} />
              <strong>{question.label}</strong>
            </span>
            <button
              type="button"
              className="icon ghost"
              aria-label={t("admin.event.showInInvites")}
              title={t("admin.event.showInInvites")}
              onClick={() => onShow(question.id)}
            >
              <Icon name="filter" />
            </button>
          </div>
          {question.kind === "choice" ? (
            <Counts question={question} counted={counted} />
          ) : (
            <TextAnswers question={question} counted={counted} language={i18n.language} />
          )}
        </div>
      ))}
    </>
  );
}

function Counts({ question, counted }: { question: Question; counted: Person[] }) {
  const { t } = useTranslation();
  return (
    <ul className="totals">
      {question.options.map((option) => (
        <li key={option.id}>
          <span className={option.active ? undefined : "muted"}>
            {option.label}
            {!option.active && ` (${t("admin.setup.hidden")})`}
          </span>
          <span>
            {
              counted.filter((person) =>
                person.answers.some(
                  (a) => a.question_id === question.id && a.option_ids.includes(option.id),
                ),
              ).length
            }
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Every written answer with its name, A to Z; how many gave none is said under them. */
function TextAnswers({
  question,
  counted,
  language,
}: {
  question: Question;
  counted: Person[];
  language: string;
}) {
  const { t } = useTranslation();
  const written = (person: Person) =>
    person.answers.find((a) => a.question_id === question.id)?.text_value?.trim() ?? "";
  const answered = sortedByName(
    counted.filter((person) => written(person) !== ""),
    language,
  );
  const without = counted.length - answered.length;
  return (
    <>
      {answered.length === 0 ? (
        <p className="muted">{t("admin.event.noTextAnswers")}</p>
      ) : (
        <ul className="persons">
          {answered.map((person) => {
            const status = t(`admin.attendance.${person.attendance}`);
            return (
              <li key={person.id}>
                <span className="status" role="img" aria-label={status} title={status}>
                  <AttendanceIcon attendance={person.attendance} />
                </span>
                <span>
                  {person.name}
                  <span className="muted"> · </span>
                  {written(person)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {without > 0 && answered.length > 0 && (
        <p className="muted">{t("admin.event.withoutAnswer", { count: without })}</p>
      )}
    </>
  );
}
