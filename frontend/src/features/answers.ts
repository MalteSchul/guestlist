import type { Schemas } from "../api/client";
import { pick } from "../i18n/text";

/** What guests answered, read the same way by hosts and guests. */

/** How far a person has answered: nothing yet, not finished, or nothing left to do. */
export const PROGRESS = ["open", "partial", "done"] as const;
export type Progress = (typeof PROGRESS)[number];

type Attendance = Schemas["PersonOut"]["attendance"];
type Question = Pick<Schemas["QuestionOut"], "id" | "kind" | "required" | "options">;
type Answer = { question_id: string; option_ids: string[]; text_value: string | null };

/** "no" is done; "yes" once every required question is answered (D27); "maybe" isn't decided. */
export function personProgress(
  questions: Question[],
  attendance: Attendance,
  answers: Answer[],
): Progress {
  switch (attendance) {
    case "pending":
      return "open";
    case "no":
      return "done";
    case "maybe":
      return "partial";
    case "yes":
      return openRequired(questions, answers).length > 0 ? "partial" : "done";
  }
}

/** Required questions without an answer. Like the backend, a choice question with no active
 * option doesn't count: nobody can answer it. */
export function openRequired<Q extends Question>(questions: Q[], answers: Answer[]): Q[] {
  return questions.filter(
    (question) =>
      question.required &&
      (question.kind === "text" || question.options.some((option) => option.active)) &&
      !answers.some(
        (a) => a.question_id === question.id && (a.option_ids.length > 0 || a.text_value),
      ),
  );
}

/** "Essen: Vegetarisch; Allergien: Nüsse" */
export function summary(
  questions: Pick<Schemas["QuestionOut"], "id" | "label" | "options">[],
  answers: Answer[],
  lang: string,
): string {
  return questions
    .flatMap((question) => {
      const answer = answers.find((a) => a.question_id === question.id);
      if (!answer) return [];
      const value =
        answer.text_value ??
        question.options
          .filter((option) => answer.option_ids.includes(option.id))
          .map((option) => pick(option.label, lang))
          .join(", ");
      return [`${pick(question.label, lang)}: ${value}`];
    })
    .join("; ");
}
