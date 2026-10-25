import type { Schemas } from "../api/client";

/** Host-written text in the reader's language, else in the other one. */
export function pick(text: Schemas["Translated"] | null | undefined, language: string): string {
  if (!text) return "";
  return (language === "en" ? (text.en ?? text.de) : (text.de ?? text.en)) ?? "";
}

export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(iso),
  );
}
